import { TFile, setIcon, setTooltip } from 'obsidian';
import { EXPLORER_VIEW_TYPE } from '../constants';
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

	const intro = container.createDiv({ cls: 'cerebrum-intro' });
	setIcon(intro.createSpan({ cls: 'cerebrum-intro-icon' }), collection.icon);
	const introText = intro.createDiv({ cls: 'cerebrum-intro-text' });
	introText.createDiv({ cls: 'cerebrum-intro-title', text: collection.title });
	introText.createDiv({
		cls: 'cerebrum-intro-desc',
		text: collection.description,
	});

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
	const sorted = sortNotes(
		filtered,
		ctx.settings.sortKey,
		ctx.settings.sortDescending,
	);

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
				ctx.settings.viewMode === 'cards'
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

function renderNote(
	container: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
): void {
	const file = ctx.view.app.vault.getFileByPath(note.path);
	const card = container.createDiv({
		cls:
			ctx.settings.viewMode === 'cards' ? 'cerebrum-card' : 'cerebrum-row',
	});
	card.setCssProps({ '--cerebrum-accent': colorFor(note.space) });

	const head = card.createDiv({ cls: 'cerebrum-card-head' });
	setIcon(
		head.createSpan({ cls: 'cerebrum-card-icon' }),
		iconForExtension(note.extension),
	);
	head.createSpan({ cls: 'cerebrum-card-title', text: note.title });
	head.createSpan({
		cls: 'cerebrum-card-time',
		text: formatRelativeTime(note.modified),
	});

	renderCardPath(card, ctx, note);

	if (ctx.settings.showExcerpts && ctx.settings.viewMode === 'cards') {
		renderExcerpt(card, ctx, note, file);
	}

	const footer = card.createDiv({ cls: 'cerebrum-card-footer' });
	const tags = footer.createDiv({ cls: 'cerebrum-card-tags' });
	for (const tag of note.tags.slice(0, 4)) {
		tags.createSpan({ cls: 'cerebrum-tag', text: tag }).addEventListener(
			'click',
			(evt) => {
				evt.stopPropagation();
				ctx.setSelection({ kind: 'tag', value: tag });
			},
		);
	}
	const links = footer.createDiv({ cls: 'cerebrum-card-links' });
	linkBadge(
		links,
		'arrow-down-left',
		note.incoming.length,
		formatCount(note.incoming.length, 'link') + ' in',
	);
	linkBadge(
		links,
		'arrow-up-right',
		note.outgoing.length,
		formatCount(note.outgoing.length, 'link') + ' out',
	);

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
	wireHoverPreview(
		ctx.view.app,
		card,
		file,
		EXPLORER_VIEW_TYPE,
		ctx.view,
	);
}

/**
 * Under the title: the note's facet values when patterns are configured, since
 * "2026 / physics / unit 3" says more than the folder path it came from.
 */
function renderCardPath(
	card: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
): void {
	const names = ctx.model.getFacetNames();
	const values = names
		.map((name) => ({ name, value: note.facets[name] }))
		.filter((entry): entry is { name: string; value: string } =>
			entry.value !== undefined,
		);
	if (values.length === 0) {
		card.createDiv({ cls: 'cerebrum-card-path', text: formatFolder(note.folder) });
		return;
	}
	const row = card.createDiv({ cls: 'cerebrum-card-path' });
	for (const entry of values) {
		const chip = row.createSpan({
			cls: 'cerebrum-card-facet',
			text: entry.value,
		});
		chip.setCssProps({
			'--cerebrum-accent': colorFor(`${entry.name}:${entry.value}`),
		});
		setTooltip(chip, `Filter by ${entry.name}`);
		chip.addEventListener('click', (evt) => {
			evt.stopPropagation();
			ctx.setFacet(entry.name, entry.value);
		});
	}
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

function linkBadge(
	container: HTMLElement,
	icon: string,
	count: number,
	tooltip: string,
): void {
	const badge = container.createSpan({ cls: 'cerebrum-link-badge' });
	setIcon(badge.createSpan({ cls: 'cerebrum-link-icon' }), icon);
	badge.createSpan({ text: String(count) });
	setTooltip(badge, tooltip);
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
		const head = row.createDiv({ cls: 'cerebrum-card-head' });
		setIcon(head.createSpan({ cls: 'cerebrum-card-icon' }), 'file-question');
		head.createSpan({ cls: 'cerebrum-card-title', text: entry.name });
		head.createSpan({
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
	const empty = container.createDiv({ cls: 'cerebrum-empty' });
	setIcon(empty.createDiv({ cls: 'cerebrum-empty-icon' }), 'search-x');
	empty.createDiv({
		cls: 'cerebrum-empty-title',
		text:
			ctx.state.query.trim() === ''
				? 'Nothing here yet'
				: 'No notes match that search',
	});
	empty.createDiv({
		cls: 'cerebrum-empty-desc',
		text:
			ctx.state.query.trim() === ''
				? 'Add a note to this space and it will appear straight away.'
				: 'Try a shorter search, or pick another collection on the left.',
	});
}
