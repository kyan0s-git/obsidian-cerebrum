import { TFile, setIcon } from 'obsidian';
import { EXPLORER_VIEW_TYPE, PAGE_SIZE } from '../constants';
import { searchNotes, sortNotes } from '../core/filters';
import {
	AlphaBucket,
	NavChild,
	Reference,
	alphabetIndex,
	noteContext,
	notesForTrail,
	overviewNote,
	placeCategories,
	resolvePlace,
	seeAlso,
} from '../core/navigation';
import { compactNumber, vaultStats } from '../core/stats';
import type { NoteEntry } from '../types';
import { formatCount, formatRelativeTime } from '../utils/format';
import { iconForExtension } from '../utils/icons';
import { colorFor } from '../utils/palette';
import { openFile, openLink, showFileMenu, wireHoverPreview } from './file-actions';
import type { ExplorerContext } from './explorer-view';

/** Notes shown under a section before it says "see all". */
const PREVIEW_PER_SECTION = 4;

/** Cross references listed at the foot of a place. */
const SEE_ALSO_LIMIT = 6;

/** Tags listed as the place's categories. */
const CATEGORY_LIMIT = 8;

export function renderBody(holder: HTMLElement, ctx: ExplorerContext): void {
	holder.empty();
	// One column with one gap, so every block sits the same distance from the
	// next whatever it is. Per-block margins drifted apart and collapsed.
	const container = holder.createDiv({ cls: 'cerebrum-blocks' });

	if (ctx.state.query.trim() !== '') {
		renderSearch(container, ctx);
		return;
	}

	switch (ctx.state.screen) {
		case 'tags':
			renderTagIndex(container, ctx);
			return;
		case 'tag':
			renderTag(container, ctx);
			return;
		case 'all':
			renderIndex(container, ctx);
			return;
		case 'loose':
			renderLooseEnds(container, ctx);
			return;
		case 'browse':
		default:
			renderBrowse(container, ctx);
	}
}

/**
 * A place in the walk: what is inside it, then what is here.
 *
 * At home that is the first level's values; a step in it is the next level's,
 * each showing a few of its notes the way a course shows a unit's lessons; at
 * the end it is only notes.
 */
function renderBrowse(container: HTMLElement, ctx: ExplorerContext): void {
	const place = resolvePlace(ctx.model, ctx.settings, ctx.state.trail);
	const atHome = ctx.state.trail.length === 0;

	if (place.children.length === 0 && place.allNotes.length === 0) {
		renderEmpty(container, ctx);
		if (atHome) {
			renderUtilities(container, ctx);
		}
		return;
	}

	if (atHome) {
		renderDashboard(container, ctx);
	}

	// The page about this place leads it, the way an article opens with what it
	// is before it lists anything.
	const lead = overviewNote(atHome ? 'Home' : place.title, place.notes);
	if (lead) {
		renderLead(container, ctx, lead);
	}

	if (place.children.length > 0) {
		if (atHome) {
			// Home is a shelf: one tile per course, nothing else competing.
			renderTiles(container, ctx, place.children);
		} else {
			for (const child of place.children) {
				renderSection(container, ctx, child);
			}
		}
	}

	// Notes that skip the next level still have somewhere to go.
	if (place.strays.length > 0) {
		const group = container.createDiv({ cls: 'cerebrum-blocks' });
		if (place.children.length > 0 && place.strayLabel !== '') {
			group.createDiv({
				cls: 'cerebrum-section-title is-quiet',
				text: place.strayLabel,
			});
		}
		for (const child of place.strays) {
			renderSection(group, ctx, child);
		}
	}

	const rest = lead
		? place.notes.filter((note) => note.path !== lead.path)
		: place.notes;
	if (rest.length > 0) {
		const heading =
			place.children.length > 0 || place.strays.length > 0 ? 'Also here' : '';
		renderNoteList(container, ctx, rest, heading);
	}

	if (atHome) {
		renderUtilities(container, ctx);
		return;
	}

	renderSeeAlso(container, ctx, place.allNotes);
	renderCategories(container, ctx, place.allNotes);
}

/**
 * The lead: the one note that explains this place, given the room to say so.
 * Everything below it is what the place contains; this is what it is.
 */
function renderLead(
	container: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
): void {
	const file = ctx.view.app.vault.getFileByPath(note.path);
	const card = container.createDiv({ cls: 'cerebrum-lead' });

	const label = card.createDiv({ cls: 'cerebrum-lead-label' });
	setIcon(label.createSpan({ cls: 'cerebrum-lead-icon' }), 'book-open');
	label.createSpan({ text: 'Start here' });

	card.createDiv({ cls: 'cerebrum-lead-title', text: note.title });
	renderExcerpt(card, ctx, note, file).addClass('cerebrum-lead-excerpt');

	if (!file) {
		return;
	}
	card.addEventListener('click', (evt) => {
		openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
	});
	card.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
		showFileMenu(ctx.view.app, file, evt, EXPLORER_VIEW_TYPE);
	});
	wireHoverPreview(ctx.view.app, card, file, EXPLORER_VIEW_TYPE, ctx.view);
}

/**
 * Pages these notes lean on that live elsewhere. Read off the links, so it
 * stays true without anyone maintaining it.
 */
function renderSeeAlso(
	container: HTMLElement,
	ctx: ExplorerContext,
	notes: NoteEntry[],
): void {
	const references: Reference[] = seeAlso(ctx.model, notes, SEE_ALSO_LIMIT);
	if (references.length === 0) {
		return;
	}
	const section = container.createDiv({ cls: 'cerebrum-section' });
	section.createDiv({ cls: 'cerebrum-section-title is-quiet', text: 'See also' });
	const list = section.createDiv({ cls: 'cerebrum-refs' });
	for (const reference of references) {
		const file = ctx.view.app.vault.getFileByPath(reference.note.path);
		const chip = list.createDiv({ cls: 'cerebrum-ref' });
		setIcon(chip.createSpan({ cls: 'cerebrum-ref-icon' }), 'corner-up-right');
		chip.createSpan({ cls: 'cerebrum-ref-name', text: reference.note.title });
		if (!file) {
			continue;
		}
		chip.addEventListener('click', (evt) => {
			openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
		});
		wireHoverPreview(ctx.view.app, chip, file, EXPLORER_VIEW_TYPE, ctx.view);
	}
}

/** The categories this place files under, the way an article footer lists them. */
function renderCategories(
	container: HTMLElement,
	ctx: ExplorerContext,
	notes: NoteEntry[],
): void {
	const categories = placeCategories(notes, CATEGORY_LIMIT);
	if (categories.length === 0) {
		return;
	}
	const row = container.createDiv({ cls: 'cerebrum-categories' });
	row.createSpan({ cls: 'cerebrum-categories-label', text: 'Categories' });
	for (const entry of categories) {
		const chip = row.createEl('a', {
			cls: 'cerebrum-category',
			text: entry.tag,
		});
		chip.addEventListener('click', () => {
			ctx.go({ screen: 'tag', tag: entry.tag, query: '' });
		});
	}
}

/**
 * Every note under its initial, with the alphabet across the top. A flat list
 * of a whole vault cannot be skimmed; the same list by letter can.
 */
function renderIndex(container: HTMLElement, ctx: ExplorerContext): void {
	const notes = visibleNotes(ctx);
	if (notes.length === 0) {
		renderEmpty(container, ctx);
		return;
	}
	const buckets: AlphaBucket[] = alphabetIndex(notes);

	const jump = container.createDiv({ cls: 'cerebrum-alphabet' });
	const sections = container.createDiv({ cls: 'cerebrum-blocks' });

	for (const bucket of buckets) {
		const section = sections.createDiv({
			cls: 'cerebrum-section cerebrum-index-group',
		});
		section.createDiv({
			cls: 'cerebrum-section-title is-quiet',
			text: bucket.letter,
		});
		const list = section.createDiv({ cls: 'cerebrum-lessons' });
		for (const note of bucket.notes) {
			// An index is a list of names. A line of prose under each one is the
			// wall of text it exists to replace.
			renderLesson(list, ctx, note, {
				excerpt: false,
				meta: noteContext(ctx.model, note),
			});
		}
		// The jump holds the section itself, so no lookup can go stale.
		const letter = jump.createEl('a', {
			cls: 'cerebrum-alphabet-letter',
			text: bucket.letter,
		});
		letter.addEventListener('click', () => {
			section.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}
}

/**
 * The dashboard: what the vault amounts to, in the numbers worth knowing.
 *
 * A row of figures rather than a chart, because these are headline counts with
 * no shape to plot — a bar chart of five unrelated totals says less than the
 * five numbers do. Each one that leads somewhere is a link to it, so the
 * dashboard is a way in and not only a readout.
 */
function renderDashboard(container: HTMLElement, ctx: ExplorerContext): void {
	const stats = vaultStats(ctx.model, ctx.settings);
	if (stats.notes === 0) {
		return;
	}
	const loose = stats.orphans + stats.unresolved;

	const tiles: {
		label: string;
		value: number;
		hint: string;
		go?: () => void;
	}[] = [
		{
			label: 'Notes',
			value: stats.notes,
			hint:
				stats.attachments > 0
					? `and ${compactNumber(stats.attachments)} attachments`
					: 'in the vault',
			go: () => {
				ctx.go({ screen: 'all', trail: [], tag: '', query: '' });
			},
		},
		{
			label: 'Links',
			value: stats.links,
			hint: `${percent(stats.connected, stats.notes)} of notes linked`,
		},
		{
			label: 'Tags',
			value: stats.tags,
			hint: 'across the vault',
			go: () => {
				ctx.go({ screen: 'tags', trail: [], tag: '', query: '' });
			},
		},
		{
			label: 'Touched this week',
			value: stats.updatedThisWeek,
			hint: 'written or edited',
		},
		{
			label: 'Loose ends',
			value: loose,
			hint: loose === 0 ? 'nothing to tidy' : 'orphans and missing pages',
			go: () => {
				ctx.go({ screen: 'loose', trail: [], tag: '', query: '' });
			},
		},
	];

	const board = container.createDiv({ cls: 'cerebrum-stats' });
	for (const tile of tiles) {
		const el = board.createEl(tile.go ? 'a' : 'div', {
			cls: tile.go ? 'cerebrum-stat is-clickable' : 'cerebrum-stat',
		});
		el.createDiv({ cls: 'cerebrum-stat-value', text: compactNumber(tile.value) });
		el.createDiv({ cls: 'cerebrum-stat-label', text: tile.label });
		el.createDiv({ cls: 'cerebrum-stat-hint', text: tile.hint });
		if (tile.go) {
			el.addEventListener('click', tile.go);
		}
	}

	// How the vault is organised, said in one line rather than five more tiles.
	if (stats.shape.length > 0) {
		container.createDiv({
			cls: 'cerebrum-shape',
			text: stats.shape
				.map((entry) => formatCount(entry.values, entry.name))
				.join(' · '),
		});
	}
}

function percent(part: number, whole: number): string {
	return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}

/** The home shelf. */
function renderTiles(
	container: HTMLElement,
	ctx: ExplorerContext,
	children: NavChild[],
): void {
	const grid = container.createDiv({ cls: 'cerebrum-tiles' });
	for (const child of children) {
		const tile = grid.createDiv({ cls: 'cerebrum-tile' });
		tile.setCssProps({ '--cerebrum-accent': colorFor(child.label) });
		tile.createDiv({ cls: 'cerebrum-tile-name', text: child.label });
		tile.createDiv({
			cls: 'cerebrum-tile-count',
			text: formatCount(child.noteCount, 'note'),
		});
		tile.addEventListener('click', () => {
			ctx.open(child.steps);
		});
	}
}

/** A unit heading with a few of its lessons, and a way into the rest. */
function renderSection(
	container: HTMLElement,
	ctx: ExplorerContext,
	child: NavChild,
): void {
	const section = container.createDiv({ cls: 'cerebrum-section' });
	const header = section.createDiv({ cls: 'cerebrum-section-header' });
	const title = header.createDiv({ cls: 'cerebrum-section-title' });
	title.setText(child.label);
	header.createDiv({
		cls: 'cerebrum-section-count',
		text: formatCount(child.noteCount, 'note'),
	});
	header.addEventListener('click', () => {
		ctx.open(child.steps);
	});

	const notes = sortNotes(
		notesForTrail(ctx.model, ctx.settings, [...ctx.state.trail, ...child.steps]),
		ctx.settings.sortKey,
	);
	const list = section.createDiv({ cls: 'cerebrum-lessons' });
	for (const note of notes.slice(0, PREVIEW_PER_SECTION)) {
		renderLesson(list, ctx, note);
	}
	if (notes.length > PREVIEW_PER_SECTION) {
		const more = section.createEl('button', {
			cls: 'cerebrum-section-more',
			text: `See all ${notes.length}`,
		});
		more.addEventListener('click', () => {
			ctx.open(child.steps);
		});
	}
}

/** A plain, ordered list of notes, which is what a unit finally contains. */
function renderNoteList(
	container: HTMLElement,
	ctx: ExplorerContext,
	notes: NoteEntry[],
	heading: string,
): void {
	const sorted = sortNotes(notes, ctx.settings.sortKey);
	const section = container.createDiv({ cls: 'cerebrum-section' });
	if (heading !== '') {
		section.createDiv({ cls: 'cerebrum-section-title is-quiet', text: heading });
	}
	const list = section.createDiv({ cls: 'cerebrum-lessons' });
	const shown = sorted.slice(0, ctx.state.visible);
	for (const note of shown) {
		renderLesson(list, ctx, note);
	}
	if (sorted.length > shown.length) {
		const more = section.createEl('button', {
			cls: 'cerebrum-section-more',
			text: `Show ${Math.min(PAGE_SIZE, sorted.length - shown.length)} more`,
		});
		more.addEventListener('click', () => {
			ctx.showMore();
		});
	}
}

/**
 * One note, the way a course lists a lesson: a title you can read at a glance,
 * a line of what it covers, and nothing else unless you look.
 */
function renderLesson(
	container: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
	options: { excerpt?: boolean; meta?: string } = {},
): void {
	const file = ctx.view.app.vault.getFileByPath(note.path);
	const row = container.createDiv({ cls: 'cerebrum-lesson' });

	const icon = row.createSpan({ cls: 'cerebrum-lesson-icon' });
	setIcon(icon, note.extension === 'md' ? 'file-text' : iconForExtension(note.extension));

	const text = row.createDiv({ cls: 'cerebrum-lesson-text' });
	text.createDiv({ cls: 'cerebrum-lesson-title', text: note.title });
	if ((options.excerpt ?? true) && ctx.settings.density === 'comfortable') {
		renderExcerpt(text, ctx, note, file);
	}

	row.createSpan({
		cls: 'cerebrum-lesson-time',
		text: options.meta ?? formatRelativeTime(note.modified),
	});

	if (!file) {
		return;
	}
	row.addEventListener('click', (evt) => {
		openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
	});
	row.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) {
			openFile(ctx.view.app, file, ctx.settings.openInNewTab, evt);
		}
	});
	row.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
		showFileMenu(ctx.view.app, file, evt, EXPLORER_VIEW_TYPE);
	});
	wireHoverPreview(ctx.view.app, row, file, EXPLORER_VIEW_TYPE, ctx.view);
}

function renderExcerpt(
	holder: HTMLElement,
	ctx: ExplorerContext,
	note: NoteEntry,
	file: TFile | null,
): HTMLElement {
	const el = holder.createDiv({ cls: 'cerebrum-lesson-excerpt' });
	if (note.summary !== '') {
		el.setText(note.summary);
		return el;
	}
	if (!file) {
		return el;
	}
	const cached = ctx.excerpts.peek(file);
	if (cached !== undefined) {
		el.setText(cached);
		return el;
	}
	void ctx.excerpts.get(file).then((text) => {
		if (el.isConnected) {
			el.setText(text);
		}
	});
	return el;
}

/** Cross-cutting, the way a blog's tag archive is. */
function renderTagIndex(container: HTMLElement, ctx: ExplorerContext): void {
	const tags = ctx.model.getTags();
	if (tags.length === 0) {
		renderEmpty(container, ctx);
		return;
	}
	const cloud = container.createDiv({ cls: 'cerebrum-tag-index' });
	for (const entry of tags) {
		const chip = cloud.createDiv({ cls: 'cerebrum-tag-chip' });
		chip.createSpan({ cls: 'cerebrum-tag-name', text: entry.tag });
		chip.createSpan({ cls: 'cerebrum-tag-count', text: String(entry.count) });
		chip.addEventListener('click', () => {
			ctx.go({ screen: 'tag', tag: entry.tag });
		});
	}
}

function renderTag(container: HTMLElement, ctx: ExplorerContext): void {
	const notes = ctx.model
		.getNotesWithTag(ctx.state.tag)
		.filter((note) => ctx.settings.showAttachments || note.isNote);
	if (notes.length === 0) {
		renderEmpty(container, ctx);
		return;
	}
	renderNoteList(container, ctx, notes, '');
}

/** The two things worth fixing rather than reading. */
function renderLooseEnds(container: HTMLElement, ctx: ExplorerContext): void {
	const orphans = ctx.model.getOrphans();
	const missing = ctx.model.getUnresolved();

	if (orphans.length === 0 && missing.length === 0) {
		const done = container.createDiv({ cls: 'cerebrum-empty' });
		done.createDiv({
			cls: 'cerebrum-empty-title',
			text: 'No loose ends',
		});
		done.createDiv({
			cls: 'cerebrum-empty-desc',
			text: 'Every note is linked, and every link has a note behind it.',
		});
		return;
	}

	if (missing.length > 0) {
		const section = container.createDiv({ cls: 'cerebrum-section' });
		section.createDiv({
			cls: 'cerebrum-section-title is-quiet',
			text: `Pages you have linked but not written (${missing.length})`,
		});
		const list = section.createDiv({ cls: 'cerebrum-lessons' });
		for (const entry of missing.slice(0, ctx.state.visible)) {
			const row = list.createDiv({ cls: 'cerebrum-lesson is-missing' });
			setIcon(
				row.createSpan({ cls: 'cerebrum-lesson-icon' }),
				'file-question',
			);
			const text = row.createDiv({ cls: 'cerebrum-lesson-text' });
			text.createDiv({ cls: 'cerebrum-lesson-title', text: entry.name });
			text.createDiv({
				cls: 'cerebrum-lesson-excerpt',
				text: `asked for by ${entry.sources.join(', ')}`,
			});
			row.addEventListener('click', (evt) => {
				openLink(
					ctx.view.app,
					entry.name,
					entry.sources[0] ?? '',
					ctx.settings.openInNewTab,
					evt,
				);
			});
		}
	}

	if (orphans.length > 0) {
		renderNoteList(
			container,
			ctx,
			orphans,
			`Notes nothing links to (${orphans.length})`,
		);
	}
}

function renderSearch(container: HTMLElement, ctx: ExplorerContext): void {
	const scope =
		ctx.state.screen === 'browse'
			? notesForTrail(ctx.model, ctx.settings, ctx.state.trail)
			: visibleNotes(ctx);
	const results = searchNotes(scope, ctx.state.query);
	if (results.length === 0) {
		renderEmpty(container, ctx);
		return;
	}
	renderNoteList(container, ctx, results, formatCount(results.length, 'result'));
}

function visibleNotes(ctx: ExplorerContext): NoteEntry[] {
	return ctx.settings.showAttachments
		? ctx.model.getAllNotes()
		: ctx.model.getAllNotes().filter((note) => note.isNote);
}

/** The ways out of the hierarchy, kept quiet at the foot of home. */
function renderUtilities(container: HTMLElement, ctx: ExplorerContext): void {
	const row = container.createDiv({ cls: 'cerebrum-utilities' });
	const link = (label: string, go: () => void): void => {
		const el = row.createEl('a', { cls: 'cerebrum-utility', text: label });
		el.addEventListener('click', go);
	};
	link('All notes', () => {
		ctx.go({ screen: 'all', trail: [] });
	});
	link('Tags', () => {
		ctx.go({ screen: 'tags', trail: [] });
	});
	const loose = ctx.model.getOrphans().length + ctx.model.getUnresolved().length;
	link(`Loose ends${loose > 0 ? ` (${loose})` : ''}`, () => {
		ctx.go({ screen: 'loose', trail: [] });
	});
}

function renderEmpty(container: HTMLElement, ctx: ExplorerContext): void {
	const searching = ctx.state.query.trim() !== '';
	const empty = container.createDiv({ cls: 'cerebrum-empty' });
	empty.createDiv({
		cls: 'cerebrum-empty-title',
		text: searching ? 'Nothing matches' : 'Nothing here yet',
	});
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

