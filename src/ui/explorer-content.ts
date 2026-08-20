import { TFile, setIcon, setTooltip } from 'obsidian';
import { EXPLORER_VIEW_TYPE } from '../constants';

/** How many level values a card shows before it is just a path again. */
const MAX_CONTEXT = 2;
import { groupNotes, searchNotes, sortNotes } from '../core/filters';
import type { NoteEntry, UnresolvedEntry } from '../types';
import { formatCount, formatFolder, formatRelativeTime } from '../utils/format';
import { iconForExtension } from '../utils/icons';
import { colorFor } from '../utils/palette';
import { applyFacets, resolveCollection } from './collections';
import { openFile, openLink, showFileMenu, wireHoverPreview } from './file-actions';
import type { ExplorerContext } from './explorer-view';

export function renderContent(
	container: HTMLElement,
	ctx: ExplorerContext,
): void {
	container.empty();

	const collection = resolveCollection(
		ctx.model,
		ctx.settings,
		ctx.state.selection,
	);

	// A heading and a count. The description explained a view that the view
	// itself explains, on every screen, forever.
	const intro = container.createDiv({ cls: 'cerebrum-intro' });
	intro.createDiv({ cls: 'cerebrum-intro-title', text: collection.title });

	const isMissingPages =
		ctx.state.selection.kind === 'smart' &&
		ctx.state.selection.value === 'unresolved';
	if (isMissingPages) {
		intro
			.createDiv({ cls: 'cerebrum-intro-count' })
			.setText(formatCount(collection.unresolved.length, 'missing page'));
		renderUnresolved(container, ctx, collection.unresolved);
		return;
	}

	if (collection.folders.length > 0) {
		renderFolders(container, ctx, collection.folders);
	}

	const faceted = applyFacets(collection.notes, ctx.state.facets);
	const filtered = searchNotes(faceted, ctx.state.query);
	const sorted = sortNotes(filtered, ctx.settings.sortKey);

	intro
		.createDiv({ cls: 'cerebrum-intro-count' })
		.setText(formatCount(sorted.length, 'note'));

	if (sorted.length === 0) {
		renderEmpty(container, ctx);
		return;
	}

	const visible = sorted.slice(0, ctx.state.visible);
	const groups = groupNotes(visible, ctx.settings.groupKey);
	for (const group of groups) {
		if (group.label !== '') {
			const heading = container.createDiv({ cls: 'cerebrum-group' });
			heading.createSpan({ cls: 'cerebrum-group-label', text: group.label });
			heading.createSpan({
				cls: 'cerebrum-group-count',
				text: String(group.notes.length),
			});
		}
		const list = container.createDiv({
			cls:
				ctx.settings.density === 'comfortable'
					? 'cerebrum-cards'
					: 'cerebrum-rows',
		});
		for (const note of group.notes) {
			renderNote(list, ctx, note);
		}
	}

	if (sorted.length > visible.length) {
		const more = container.createEl('button', {
			cls: 'cerebrum-more',
			text: `Show more (${sorted.length - visible.length} left)`,
		});
		more.addEventListener('click', () => {
			ctx.showMore();
		});
	}
}

function renderFolders(
	container: HTMLElement,
	ctx: ExplorerContext,
	folders: { path: string; name: string; totalCount: number }[],
): void {
	const wrapper = container.createDiv({ cls: 'cerebrum-folders' });
	for (const folder of folders) {
		const card = wrapper.createDiv({ cls: 'cerebrum-folder' });
		card.setCssProps({
			'--cerebrum-accent': colorFor(folder.path.split('/')[0] ?? folder.name),
		});
		setIcon(card.createSpan({ cls: 'cerebrum-folder-icon' }), 'folder');
		card.createSpan({ cls: 'cerebrum-folder-name', text: folder.name });
		card.createSpan({
			cls: 'cerebrum-folder-count',
			text: String(folder.totalCount),
		});
		card.addEventListener('click', () => {
			ctx.setSelection({ kind: 'folder', value: folder.path });
		});
	}
}

/**
 * A card answers one question: is this the note I want?
 *
 * So it carries a title, a couple of lines of what the note says, and the least
 * context that still tells it apart from its neighbours. Link counts live on
 * hover, and anything you are already filtering by is left out, because a card
 * where six things compete at the same weight is one you read instead of scan.
 */
function renderNote(
	container: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
): void {
	const file = ctx.view.app.vault.getFileByPath(note.path);
	const card = container.createDiv({
		cls:
			ctx.settings.density === 'comfortable'
				? 'cerebrum-card'
				: 'cerebrum-row',
	});

	const title = card.createDiv({ cls: 'cerebrum-card-title' });
	// An icon earns its place only where the file is not an ordinary note.
	if (note.extension !== 'md') {
		setIcon(
			title.createSpan({ cls: 'cerebrum-card-icon' }),
			iconForExtension(note.extension),
		);
	}
	title.createSpan({ text: note.title });

	// Room for what the note says is the whole difference between the two.
	if (ctx.settings.density === 'comfortable') {
		renderExcerpt(card, ctx, note, file);
	}

	renderMeta(card, ctx, note);

	if (!file) {
		return;
	}
	card.addEventListener('click', (evt) => {
		openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
	});
	card.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) {
			openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
		}
	});
	card.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
		showFileMenu(ctx.view.app, file, evt, EXPLORER_VIEW_TYPE);
	});
	wireHoverPreview(ctx.view.app, card, file, EXPLORER_VIEW_TYPE, ctx.view);
}

/**
 * One quiet line under the card: where the note sits, when it last changed,
 * and — only while the pointer is on it — how connected it is.
 *
 * Context leaves out whatever is already filtered. Browsing physics in 2026,
 * every card would otherwise repeat "2026 physics" on every single card.
 */
function renderMeta(
	card: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
): void {
	const meta = card.createDiv({ cls: 'cerebrum-card-meta' });
	const context = meta.createDiv({ cls: 'cerebrum-card-context' });

	const shown: { name: string; value: string }[] = [];
	for (const name of ctx.model.getFacetNames()) {
		if (ctx.state.facets[name] !== undefined) {
			continue;
		}
		const value = note.facets[name]?.[0];
		if (value !== undefined) {
			shown.push({ name, value });
		}
	}

	if (shown.length === 0) {
		// Nothing else to say: the folder answers "where is this", unless that
		// is exactly what you are browsing.
		const browsing =
			ctx.state.selection.kind === 'folder' &&
			ctx.state.selection.value === note.folder;
		if (!browsing) {
			context.createSpan({
				cls: 'cerebrum-card-crumb',
				text: formatFolder(note.folder),
			});
		}
	} else {
		for (const entry of shown.slice(0, MAX_CONTEXT)) {
			const crumb = context.createSpan({
				cls: 'cerebrum-card-crumb is-clickable',
				text: entry.value,
			});
			setTooltip(crumb, `Filter by ${entry.name}`);
			crumb.addEventListener('click', (evt) => {
				evt.stopPropagation();
				ctx.setFacet(entry.name, entry.value);
			});
		}
	}

	meta.createSpan({
		cls: 'cerebrum-card-time',
		text: formatRelativeTime(note.modified),
	});

	const links = meta.createSpan({ cls: 'cerebrum-card-links' });
	setTooltip(
		links,
		`${formatCount(note.incoming.length, 'link')} in, ${formatCount(
			note.outgoing.length,
			'link',
		)} out`,
	);
	setIcon(links.createSpan({ cls: 'cerebrum-link-icon' }), 'link');
	links.createSpan({
		text: String(note.incoming.length + note.outgoing.length),
	});
}

function renderExcerpt(
	card: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
	file: TFile | null,
): void {
	const el = card.createDiv({ cls: 'cerebrum-card-excerpt' });
	if (note.summary !== '') {
		el.setText(note.summary);
		return;
	}
	if (!file) {
		return;
	}
	const cached = ctx.excerpts.peek(file);
	if (cached !== undefined) {
		el.setText(cached);
		return;
	}
	void ctx.excerpts.get(file).then((text) => {
		if (el.isConnected) {
			el.setText(text);
		}
	});
}

/** Missing pages get their own layout: the link text plus who is asking for it. */
function renderUnresolved(
	container: HTMLElement,
	ctx: ExplorerContext,
	entries: UnresolvedEntry[],
): void {
	const filtered =
		ctx.state.query.trim() === ''
			? entries
			: entries.filter((entry) =>
					entry.name.toLowerCase().includes(ctx.state.query.toLowerCase()),
				);
	if (filtered.length === 0) {
		renderEmpty(container, ctx);
		return;
	}
	const list = container.createDiv({ cls: 'cerebrum-rows' });
	for (const entry of filtered.slice(0, ctx.state.visible)) {
		const row = list.createDiv({ cls: 'cerebrum-row is-missing' });
		const title = row.createDiv({ cls: 'cerebrum-card-title' });
		setIcon(title.createSpan({ cls: 'cerebrum-card-icon' }), 'file-question');
		title.createSpan({ text: entry.name });
		row.createDiv({
			cls: 'cerebrum-card-meta',
		}).createSpan({
			cls: 'cerebrum-card-time',
			text: formatCount(entry.sources.length, 'reference'),
		});
		const sources = row.createDiv({ cls: 'cerebrum-card-sources' });
		for (const source of entry.sources.slice(0, 6)) {
			const chip = sources.createSpan({
				cls: 'cerebrum-source',
				text: source,
			});
			chip.addEventListener('click', (evt) => {
				evt.stopPropagation();
				const file = ctx.view.app.vault.getFileByPath(source);
				if (file) {
					openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
				}
			});
		}
		row.addEventListener('click', (evt) => {
			const source = entry.sources[0] ?? '';
			openLink(
				ctx.view.app,
				entry.name,
				source,
				ctx.settings.openInNewTab,
				evt,
			);
		});
	}
	if (filtered.length > ctx.state.visible) {
		const more = container.createEl('button', {
			cls: 'cerebrum-more',
			text: `Show more (${filtered.length - ctx.state.visible} left)`,
		});
		more.addEventListener('click', () => {
			ctx.showMore();
		});
	}
}

function renderEmpty(container: HTMLElement, ctx: ExplorerContext): void {
	const searching = ctx.state.query.trim() !== '';
	const filtered = Object.keys(ctx.state.facets).length > 0;

	const empty = container.createDiv({ cls: 'cerebrum-empty' });
	empty.createDiv({
		cls: 'cerebrum-empty-title',
		text: searching || filtered ? 'Nothing matches' : 'Nothing here yet',
	});

	// An empty state that only describes the dead end leaves you to find the
	// way out yourself.
	if (filtered) {
		const clear = empty.createEl('button', { text: 'Clear filters' });
		clear.addEventListener('click', () => {
			ctx.clearFacets();
		});
		return;
	}
	if (searching) {
		const clear = empty.createEl('button', { text: 'Clear search' });
		clear.addEventListener('click', () => {
			ctx.setQuery('');
		});
		return;
	}
	empty.createDiv({
		cls: 'cerebrum-empty-desc',
		text: 'Add a note here and it will appear straight away.',
	});
}
