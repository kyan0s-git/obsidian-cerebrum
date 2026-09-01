import {
	App,
	CachedMetadata,
	TFile,
	TFolder,
	getAllTags,
	getLinkpath,
} from 'obsidian';
import { NOTE_EXTENSIONS } from '../constants';
import {
	FacetCandidateSource,
	FacetCount,
	FacetDefinition,
	FacetRule,
	countValues,
	dedupeFacets,
	detectRules,
	discoverFacets,
	facetsForNote,
	parseRules,
	patternNames,
} from './facets';
import type { CerebrumSettings } from '../settings';
import type {
	FolderEntry,
	LinkRef,
	NoteEntry,
	UnresolvedEntry,
} from '../types';

/**
 * An in-memory picture of the vault: every file, every folder and every link
 * between them.
 *
 * Nothing here is hardcoded to a particular vault layout. Folders are whatever
 * the vault happens to contain at the moment the index is built, so a folder
 * added next to existing ones shows up on the next rebuild without any
 * configuration.
 */
export class VaultModel {
	private notes = new Map<string, NoteEntry>();
	private folders = new Map<string, FolderEntry>();
	private tagCounts = new Map<string, number>();
	private rules: FacetRule[] = [];
	private facetOrder: string[] = [];
	private discovered: FacetDefinition[] = [];
	/** Tags and frontmatter per note, kept only while a rebuild is running. */
	private candidates = new Map<string, FacetCandidateSource>();
	private unresolved = new Map<string, UnresolvedEntry>();
	private listeners = new Set<() => void>();
	private built = false;

	constructor(
		private readonly app: App,
		private readonly settings: () => CerebrumSettings,
	) {}

	/** Registers a callback fired after every rebuild. Returns an unsubscriber. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Rebuilds the whole index and notifies subscribers. */
	rebuild(): void {
		this.notes.clear();
		this.folders.clear();
		this.tagCounts.clear();
		this.unresolved.clear();

		this.indexFolders();
		this.rules = this.resolveRules();
		this.indexFiles();
		this.indexFacets();
		this.indexLinks();
		this.built = true;

		for (const listener of this.listeners) {
			listener();
		}
	}

	/** Tells subscribers to redraw without rebuilding the index. */
	notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	/** Rebuilds only if the index has never been built. */
	ensureBuilt(): void {
		if (!this.built) {
			this.rebuild();
		}
	}

	getNote(path: string): NoteEntry | undefined {
		return this.notes.get(path);
	}

	getAllNotes(): NoteEntry[] {
		return Array.from(this.notes.values());
	}

	getFolder(path: string): FolderEntry | undefined {
		return this.folders.get(path);
	}

	getAllFolders(): FolderEntry[] {
		return Array.from(this.folders.values());
	}

	/** Direct children of a folder, sorted by name. */
	getChildFolders(path: string): FolderEntry[] {
		const parent = this.folders.get(path);
		if (!parent) {
			return [];
		}
		const children: FolderEntry[] = [];
		for (const childPath of parent.childFolders) {
			const child = this.folders.get(childPath);
			if (child) {
				children.push(child);
			}
		}
		return children.sort((a, b) => a.name.localeCompare(b.name));
	}

	getNotesWithTag(tag: string): NoteEntry[] {
		return this.getAllNotes().filter((note) => note.tags.includes(tag));
	}

	/** Tags across the vault with their note counts, most used first. */
	getTags(): { tag: string; count: number }[] {
		return Array.from(this.tagCounts.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	}

	/** Level names: the ones patterns declare, then the ones discovered. */
	getFacetNames(): string[] {
		return [...this.facetOrder];
	}

	/** Where each level came from, for the settings interface. */
	getFacetDefinitions(): FacetDefinition[] {
		return [...this.discovered];
	}

	/**
	 * Values of one facet across the given notes, narrowed by the other active
	 * filters so drilling into a year leaves only the subjects taught that year.
	 */
	getFacetValues(
		notes: NoteEntry[],
		name: string,
		filters: Record<string, string>,
	): FacetCount[] {
		return countValues(notes, name, filters);
	}

	/** Link targets that do not exist yet, most referenced first. */
	getUnresolved(): UnresolvedEntry[] {
		return Array.from(this.unresolved.values()).sort(
			(a, b) => b.sources.length - a.sources.length,
		);
	}

	/** Notes with no incoming and no resolved outgoing links. */
	getOrphans(): NoteEntry[] {
		return this.getAllNotes().filter(
			(note) =>
				note.isNote &&
				note.incoming.length === 0 &&
				note.outgoing.filter((link) => link.resolved).length === 0,
		);
	}

	/** Notes sorted by how many pages point at them. */
	getHubs(): NoteEntry[] {
		return this.getAllNotes()
			.filter((note) => note.incoming.length > 0)
			.sort((a, b) => b.incoming.length - a.incoming.length);
	}

	/** True when the path sits inside a folder the user excluded. */
	isExcluded(path: string): boolean {
		for (const folder of this.settings().excludedFolders) {
			const trimmed = folder.trim().replace(/^\/+|\/+$/g, '');
			if (trimmed === '') {
				continue;
			}
			if (path === trimmed || path.startsWith(`${trimmed}/`)) {
				return true;
			}
		}
		return false;
	}

	private indexFolders(): void {
		const root = this.app.vault.getRoot();
		this.folders.set('', {
			path: '',
			name: this.app.vault.getName(),
			parent: '',
			depth: 0,
			childFolders: [],
			directCount: 0,
			totalCount: 0,
			modified: 0,
		});
		this.walkFolder(root, 0);
	}

	private walkFolder(folder: TFolder, depth: number): void {
		const entry = this.folders.get(folder.isRoot() ? '' : folder.path);
		if (!entry) {
			return;
		}
		for (const child of folder.children) {
			if (this.isExcluded(child.path)) {
				continue;
			}
			if (child instanceof TFolder) {
				this.folders.set(child.path, {
					path: child.path,
					name: child.name,
					parent: entry.path,
					depth: depth + 1,
					childFolders: [],
					directCount: 0,
					totalCount: 0,
					modified: 0,
				});
				entry.childFolders.push(child.path);
				this.walkFolder(child, depth + 1);
			}
		}
	}

	private indexFiles(): void {
		for (const file of this.app.vault.getFiles()) {
			if (this.isExcluded(file.path)) {
				continue;
			}
			const entry = this.createEntry(file, NOTE_EXTENSIONS.has(file.extension));
			this.notes.set(entry.path, entry);
			for (const tag of entry.tags) {
				this.tagCounts.set(tag, (this.tagCounts.get(tag) ?? 0) + 1);
			}
			this.countInFolders(entry);
		}
	}

	/** Folder counts are note counts: attachments are not what you browse for. */
	private countInFolders(entry: NoteEntry): void {
		if (!entry.isNote) {
			return;
		}
		const direct = this.folders.get(entry.folder);
		if (direct) {
			direct.directCount += 1;
		}
		let current: FolderEntry | undefined = direct;
		while (current) {
			current.totalCount += 1;
			current.modified = Math.max(current.modified, entry.modified);
			if (current.path === '') {
				break;
			}
			current = this.folders.get(current.parent);
		}
	}

	private createEntry(file: TFile, isNote: boolean): NoteEntry {
		const cache = this.app.metadataCache.getFileCache(file);
		const folder = file.parent && !file.parent.isRoot() ? file.parent.path : '';
		const frontmatter: Record<string, unknown> | undefined = cache?.frontmatter;
		const tags = cache ? (getAllTags(cache) ?? []) : [];
		this.candidates.set(file.path, { tags, frontmatter });
		return {
			path: file.path,
			basename: file.basename,
			extension: file.extension,
			folder,
			space: folder === '' ? '' : (folder.split('/')[0] ?? ''),
			title: readString(frontmatter, ['title']) ?? file.basename,
			summary:
				readString(frontmatter, ['description', 'summary', 'abstract']) ?? '',
			tags,
			aliases: readStringList(frontmatter, 'aliases'),
			facets: {},
			created: file.stat.ctime,
			modified: file.stat.mtime,
			size: file.stat.size,
			isNote,
			outgoing: [],
			incoming: [],
		};
	}

	/**
	 * Levels are decided from the whole vault, then applied to every note: a
	 * property only becomes a level once enough notes share its values, which
	 * cannot be known one note at a time.
	 */
	/**
	 * The patterns to read paths with.
	 *
	 * Written ones win: they are the user saying what their folders mean. With
	 * none written, the shape of the vault is read off the folders themselves,
	 * because a plugin that can work out the patterns but only if you find the
	 * button has not worked anything out for anybody.
	 */
	private resolveRules(): FacetRule[] {
		const settings = this.settings();
		const written = parseRules(settings.facetPatterns);
		if (written.length > 0 || !settings.autoFacets) {
			return written;
		}
		return parseRules(
			detectRules(
				this.getAllFolders()
					.map((folder) => folder.path)
					.filter((path) => path !== ''),
			),
		);
	}

	private indexFacets(): void {
		const settings = this.settings();
		this.facetOrder = patternNames(this.rules);
		this.discovered = settings.autoFacets
			? discoverFacets(Array.from(this.candidates.values()), {
					exclude: [...this.facetOrder, ...settings.hiddenFacets],
				})
			: [];
		for (const definition of this.discovered) {
			if (!this.facetOrder.includes(definition.name)) {
				this.facetOrder.push(definition.name);
			}
		}

		const hidden = new Set(
			settings.hiddenFacets.map((name) => name.trim().toLowerCase()),
		);
		this.facetOrder = this.facetOrder.filter((name) => !hidden.has(name));

		this.applyFacets();

		// Two levels holding the same values for the same notes are one
		// dimension named twice, which can only be seen once every note has its
		// values, so the pass runs again with the survivors.
		const all = this.getAllNotes();
		const declared: FacetDefinition[] = this.facetOrder.map((name) => ({
			name,
			source: this.discovered.find((d) => d.name === name)?.source ?? 'path',
			coverage: all.filter((note) => (note.facets[name] ?? []).length > 0)
				.length,
		}));
		const survivors = dedupeFacets(declared, all);
		if (survivors.length !== declared.length) {
			this.facetOrder = survivors.map((definition) => definition.name);
			this.discovered = this.discovered.filter((definition) =>
				survivors.some((s) => s.name === definition.name),
			);
			this.applyFacets();
		}
		this.candidates.clear();
	}

	private applyFacets(): void {
		for (const entry of this.notes.values()) {
			const candidate = this.candidates.get(entry.path);
			if (!candidate) {
				continue;
			}
			const folders = entry.folder === '' ? [] : entry.folder.split('/');
			entry.facets = facetsForNote(
				folders,
				candidate,
				this.rules,
				this.discovered,
			);
		}
	}

	private indexLinks(): void {
		for (const entry of this.notes.values()) {
			if (entry.extension !== 'md') {
				continue;
			}
			const file = this.app.vault.getFileByPath(entry.path);
			if (!file) {
				continue;
			}
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache) {
				continue;
			}
			const seen = new Set<string>();
			for (const ref of collectRefs(cache)) {
				const link = this.resolveRef(ref.link, ref.display, ref.kind, entry.path);
				const key = `${link.kind}:${link.target}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				entry.outgoing.push(link);
				this.recordIncoming(entry.path, link);
			}
		}
	}

	private resolveRef(
		linktext: string,
		display: string,
		kind: LinkRef['kind'],
		sourcePath: string,
	): LinkRef {
		const target = this.app.metadataCache.getFirstLinkpathDest(
			getLinkpath(linktext),
			sourcePath,
		);
		if (target && !this.isExcluded(target.path)) {
			return { target: target.path, kind, resolved: true, display };
		}
		return { target: linktext, kind, resolved: false, display };
	}

	private recordIncoming(sourcePath: string, link: LinkRef): void {
		if (!link.resolved) {
			const existing = this.unresolved.get(link.target);
			if (existing) {
				if (!existing.sources.includes(sourcePath)) {
					existing.sources.push(sourcePath);
				}
			} else {
				this.unresolved.set(link.target, {
					name: link.target,
					sources: [sourcePath],
				});
			}
			return;
		}
		const target = this.notes.get(link.target);
		if (target && !target.incoming.includes(sourcePath)) {
			target.incoming.push(sourcePath);
		}
	}
}

/** Every reference a page makes: inline links, embeds and frontmatter links. */
function collectRefs(
	cache: CachedMetadata,
): { link: string; display: string; kind: LinkRef['kind'] }[] {
	const refs: { link: string; display: string; kind: LinkRef['kind'] }[] = [];
	for (const link of cache.links ?? []) {
		refs.push({ link: link.link, display: link.displayText ?? '', kind: 'link' });
	}
	for (const embed of cache.embeds ?? []) {
		refs.push({
			link: embed.link,
			display: embed.displayText ?? '',
			kind: 'embed',
		});
	}
	for (const link of cache.frontmatterLinks ?? []) {
		refs.push({
			link: link.link,
			display: link.displayText ?? '',
			kind: 'frontmatter',
		});
	}
	return refs;
}

function readString(
	frontmatter: Record<string, unknown> | undefined,
	keys: string[],
): string | undefined {
	if (!frontmatter) {
		return undefined;
	}
	for (const key of keys) {
		const value = frontmatter[key];
		if (typeof value === 'string' && value.trim() !== '') {
			return value.trim();
		}
	}
	return undefined;
}

function readStringList(
	frontmatter: Record<string, unknown> | undefined,
	key: string,
): string[] {
	const value = frontmatter?.[key];
	if (typeof value === 'string') {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string');
	}
	return [];
}
