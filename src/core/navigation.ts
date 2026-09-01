/**
 * Navigation: the vault read as a course rather than a database.
 *
 * The levels already form an ordered hierarchy — year, then subject, then unit.
 * A filter rail offers all of it at once, which is powerful and exhausting. A
 * course offers one decision per screen: pick a subject, see its units, pick a
 * unit, see its lessons, and a breadcrumb back to anywhere you have been.
 *
 * This module answers, for any point in that walk: where am I, what can I go
 * into next, and what is here?
 */

import type { CerebrumSettings } from '../settings';
import type { FolderEntry, NoteEntry } from '../types';
import type { VaultModel } from './vault-model';
import { pluralise } from '../utils/format';
import { matchesFilters } from './facets';

/** One step of the walk: a level name and the value chosen for it. */
export interface TrailStep {
	name: string;
	value: string;
}

/** The name used when the vault has no levels and folders are the hierarchy. */
export const FOLDER_AXIS = 'folder';

export interface NavChild {
	label: string;
	/**
	 * The steps taken by opening this child. Usually one, but a run of levels
	 * that only ever leads one way is walked in a single click rather than
	 * making you confirm the obvious three times.
	 */
	steps: TrailStep[];
	noteCount: number;
	/** True when this child has children of its own. */
	hasChildren: boolean;
}

export interface NavCrumb {
	label: string;
	trail: TrailStep[];
	/** True when the step before it offered no other way on. */
	forced: boolean;
}

export interface NavPlace {
	/** Every step back to the start, innermost last. */
	crumbs: NavCrumb[];
	title: string;
	/** What one level down is called here: "Units", "Folders". */
	childLabel: string;
	/** The same, for exactly one of them: "unit", "folder". */
	childName: string;
	/**
	 * Children found further down the levels, for notes that skip the next one.
	 * A class's `concepts` pages belong to no unit, so without this they fall
	 * out of the walk and pile up under "Also here".
	 */
	strays: NavChild[];
	/** What those are called: "Kinds". */
	strayLabel: string;
	children: NavChild[];
	/** Notes at exactly this point, not inside one of the children. */
	notes: NoteEntry[];
	/** Every note at or below this point. */
	allNotes: NoteEntry[];
}

/**
 * The hierarchy to walk. Levels when the vault has them, folders otherwise, so
 * a vault that has never been configured still browses as a course.
 */
export function navAxes(model: VaultModel): string[] {
	const levels = model.getFacetNames();
	return levels.length > 0 ? levels : [FOLDER_AXIS];
}

/** Notes matching every step taken so far. */
export function notesForTrail(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
): NoteEntry[] {
	const all = settings.showAttachments
		? model.getAllNotes()
		: model.getAllNotes().filter((note) => note.isNote);

	const folderStep = trail.filter((step) => step.name === FOLDER_AXIS).pop();
	const levelFilters: Record<string, string> = {};
	for (const step of trail) {
		if (step.name !== FOLDER_AXIS) {
			levelFilters[step.name] = step.value;
		}
	}

	return all.filter((note) => {
		if (folderStep && !isInside(note.folder, folderStep.value)) {
			return false;
		}
		return matchesFilters(note.facets, levelFilters);
	});
}

function isInside(folder: string, root: string): boolean {
	return root === '' || folder === root || folder.startsWith(`${root}/`);
}

/** Everything the browser needs to draw one point in the walk. */
export function resolvePlace(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
): NavPlace {
	const axes = navAxes(model);
	const folderMode = axes[0] === FOLDER_AXIS;
	const allNotes = notesForTrail(model, settings, trail);

	const children = childrenOf(model, settings, trail, axes, allNotes);
	const crumbs = crumbsFor(model, settings, trail, axes, folderMode);
	// The heading is the last crumb, so both say the place the same way.
	const title = crumbs[crumbs.length - 1]?.label ?? 'Home';

	const here = allNotes.filter(
		(note) => !isInsideChild(note, trail, axes, folderMode),
	);
	const stray = strayChildren(trail, axes, here, folderMode);
	const inStray = new Set<string>();
	for (const child of stray.children) {
		const step = child.steps[0];
		if (!step) {
			continue;
		}
		for (const note of here) {
			if ((note.facets[step.name] ?? []).includes(step.value)) {
				inStray.add(note.path);
			}
		}
	}

	return {
		crumbs,
		title,
		childLabel: folderMode ? 'Folders' : plural(axes[trail.length] ?? ''),
		childName: folderMode ? 'folder' : (axes[trail.length] ?? ''),
		children: children.map((child) => ({
			...child,
			// A unit called "physics unit 1" inside physics says physics twice.
			label: trimRepeat(child.label, title),
		})),
		strays: stray.children,
		strayLabel: stray.label,
		notes: here.filter((note) => !inStray.has(note.path)),
		allNotes,
	};
}

/**
 * A way on for the notes that have no value for the next level.
 *
 * A class's `concepts` and `entities` pages sit in no unit at all, so the unit
 * step has nothing to offer them. They do have a level further down, though, so
 * the walk skips ahead to the first one they answer to rather than dropping
 * them into a flat list of leftovers.
 */
function strayChildren(
	trail: TrailStep[],
	axes: string[],
	here: NoteEntry[],
	folderMode: boolean,
): { label: string; children: NavChild[] } {
	if (folderMode || here.length === 0) {
		return { label: '', children: [] };
	}
	for (let index = trail.length + 1; index < axes.length; index++) {
		const name = axes[index];
		if (name === undefined) {
			continue;
		}
		const counts = new Map<string, number>();
		for (const note of here) {
			for (const value of note.facets[name] ?? []) {
				counts.set(value, (counts.get(value) ?? 0) + 1);
			}
		}
		if (counts.size === 0) {
			continue;
		}
		return {
			label: plural(name),
			children: Array.from(counts.entries())
				.map(([value, noteCount]) => ({
					label: value,
					steps: [{ name, value }],
					noteCount,
					hasChildren: index < axes.length - 1,
				}))
				.sort((a, b) => compareLabels(a.label, b.label)),
		};
	}
	return { label: '', children: [] };
}

/**
 * How far a single click should carry you.
 *
 * A level that only ever leads one way is not a decision, it is a corridor: a
 * year holding one subject, a folder holding one folder. Walking it a screen at
 * a time is the path redundancy that makes a deep vault feel like a chore, so
 * opening a child walks straight through any corridor behind it.
 */
export function descend(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
): TrailStep[] {
	const axes = navAxes(model);
	let walked = trail;
	// The hierarchy is finite, so this cannot run away.
	for (let depth = 0; depth < axes.length + MAX_FOLDER_DEPTH; depth++) {
		const here = notesForTrail(model, settings, walked);
		const children = childrenOf(model, settings, walked, axes, here);
		const only = children[0];
		if (children.length !== 1 || only === undefined) {
			return walked;
		}
		// A note filed at this point is a reason to stop: it would be skipped.
		const folderMode = axes[0] === FOLDER_AXIS;
		if (here.some((note) => !isInsideChild(note, walked, axes, folderMode))) {
			return walked;
		}
		walked = [...walked, ...only.steps];
	}
	return walked;
}

/** Folders can nest arbitrarily; this is the point at which we stop looking. */
const MAX_FOLDER_DEPTH = 24;

function childrenOf(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
	axes: string[],
	scope: NoteEntry[],
): NavChild[] {
	return axes[0] === FOLDER_AXIS
		? folderChildren(model, trail)
		: levelChildren(trail, axes, scope);
}

/**
 * The way back, with each step told apart by whether it was ever a choice. A
 * step whose parent offered nothing else is folded into the crumb before it, so
 * the trail reads as the decisions you made rather than every level crossed.
 */
function crumbsFor(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
	axes: string[],
	folderMode: boolean,
): NavCrumb[] {
	const crumbs: NavCrumb[] = [{ label: 'Home', trail: [], forced: false }];
	let previous = 'Home';
	for (let index = 0; index < trail.length; index++) {
		const step = trail[index];
		if (!step) {
			continue;
		}
		const prefix = trail.slice(0, index);
		const siblings = childrenOf(
			model,
			settings,
			prefix,
			axes,
			notesForTrail(model, settings, prefix),
		).length;
		const text = trimRepeat(label(step, folderMode), previous);
		crumbs.push({ label: text, trail: trail.slice(0, index + 1), forced: siblings < 2 });
		previous = text;
	}
	return crumbs;
}

/** Whether a note sits inside one of this place's children rather than at it. */
function isInsideChild(
	note: NoteEntry,
	trail: TrailStep[],
	axes: string[],
	folderMode: boolean,
): boolean {
	if (folderMode) {
		return note.folder !== (trail[trail.length - 1]?.value ?? '');
	}
	const next = axes[trail.length];
	return next !== undefined && (note.facets[next]?.length ?? 0) > 0;
}

/** Values of the next level, among the notes that are actually here. */
function levelChildren(
	trail: TrailStep[],
	axes: string[],
	scope: NoteEntry[],
): NavChild[] {
	const name = axes[trail.length];
	if (name === undefined) {
		return [];
	}
	const counts = new Map<string, number>();
	for (const note of scope) {
		for (const value of note.facets[name] ?? []) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	const hasDeeper = axes.length > trail.length + 1;
	return Array.from(counts.entries())
		.map(([value, noteCount]) => ({
			label: value,
			steps: [{ name, value }],
			noteCount,
			hasChildren: hasDeeper,
		}))
		.sort((a, b) => compareLabels(a.label, b.label));
}

function folderChildren(model: VaultModel, trail: TrailStep[]): NavChild[] {
	const here = trail[trail.length - 1]?.value ?? '';
	return model.getChildFolders(here).map((folder: FolderEntry) => ({
		label: folder.name,
		steps: [{ name: FOLDER_AXIS, value: folder.path }],
		noteCount: folder.totalCount,
		hasChildren: folder.childFolders.length > 0,
	}));
}

const YEAR = /^(?:19|20)\d{2}(?:[-/–]\d{2,4})?$/;

/** Years newest first, everything else naturally. */
function compareLabels(a: string, b: string): number {
	if (YEAR.test(a) && YEAR.test(b)) {
		return b.localeCompare(a);
	}
	return a.localeCompare(b, undefined, { numeric: true });
}

function label(step: TrailStep, folderMode: boolean): string {
	return folderMode ? (step.value.split('/').pop() ?? step.value) : step.value;
}

/**
 * Drops what a label already says. "physics unit 1" under physics is "unit 1";
 * "2026" under "2026" is nothing worth repeating, so it keeps its own name.
 */
function trimRepeat(text: string, parent: string): string {
	const key = normalise(parent);
	if (key === '' || normalise(text) === key) {
		return text;
	}
	const trimmed = text
		.replace(new RegExp(`^${escapeRegExp(parent)}[\\s._/-]+`, 'i'), '')
		.replace(new RegExp(`[\\s._/-]+${escapeRegExp(parent)}$`, 'i'), '')
		.trim();
	return trimmed === '' ? text : trimmed;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "unit" describes one, "Units" heads a list of them. */
function plural(name: string): string {
	return name === ''
		? ''
		: pluralise(name.charAt(0).toUpperCase() + name.slice(1));
}

/*
 * The rest of this module borrows from an encyclopaedia rather than a course.
 * Wikipedia solves the same problem a vault has — thousands of pages that only
 * make sense next to each other — with four devices: a category has one main
 * article that explains it, an article ends with "see also" and its categories,
 * and everything is reachable from an alphabetical index.
 */

/** Names a note can carry to mean "this is the page about this place". */
const INDEX_NAMES = new Set(['index', '_index', 'readme', 'overview', 'home']);

/**
 * The note that reads as this place's own article.
 *
 * A unit called "Kinematics" holding a note called "Kinematics" is not a lesson
 * inside the unit, it is the unit explained — so it leads the page instead of
 * queueing up with everything else.
 */
export function overviewNote(
	title: string,
	notes: NoteEntry[],
): NoteEntry | null {
	const wanted = normalise(title);
	if (wanted === '') {
		return null;
	}
	let fallback: NoteEntry | null = null;
	for (const note of notes) {
		if (!note.isNote) {
			continue;
		}
		if (normalise(note.title) === wanted || note.aliases.some((alias) => normalise(alias) === wanted)) {
			return note;
		}
		if (fallback === null && INDEX_NAMES.has(note.basename.toLowerCase())) {
			fallback = note;
		}
	}
	return fallback;
}

/** A referenced page and how many notes here point at it. */
export interface Reference {
	note: NoteEntry;
	count: number;
}

/**
 * Pages the notes here lean on that live somewhere else — an article's "see
 * also", read off the links rather than written by hand. It is the one place
 * the hierarchy is allowed to be crossed without going through search.
 */
export function seeAlso(
	model: VaultModel,
	here: NoteEntry[],
	limit: number,
): Reference[] {
	const inside = new Set(here.map((note) => note.path));
	const counts = new Map<string, number>();
	for (const note of here) {
		const seen = new Set<string>();
		for (const link of note.outgoing) {
			if (!link.resolved || inside.has(link.target) || seen.has(link.target)) {
				continue;
			}
			seen.add(link.target);
			counts.set(link.target, (counts.get(link.target) ?? 0) + 1);
		}
	}
	const references: Reference[] = [];
	for (const [path, count] of counts) {
		const note = model.getNote(path);
		if (note?.isNote) {
			references.push({ note, count });
		}
	}
	return references
		.sort((a, b) => b.count - a.count || a.note.title.localeCompare(b.note.title))
		.slice(0, limit);
}

/**
 * The tags the notes here actually share, which is the footer of categories an
 * article carries. One tag on one note says nothing about the place, so tags
 * used once are left to the note itself.
 */
export function placeCategories(
	here: NoteEntry[],
	limit: number,
): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const note of here) {
		for (const tag of new Set(note.tags)) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return Array.from(counts.entries())
		.filter(([, count]) => count > 1)
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
		.slice(0, limit);
}

/** One letter of the index and the notes filed under it. */
export interface AlphaBucket {
	letter: string;
	notes: NoteEntry[];
}

/**
 * Every note, filed by first letter. A list of a thousand notes is unreadable
 * in any order; the same list under its initials can be skimmed in seconds.
 */
export function alphabetIndex(notes: NoteEntry[]): AlphaBucket[] {
	const buckets = new Map<string, NoteEntry[]>();
	for (const note of notes) {
		const letter = initial(note.title);
		const bucket = buckets.get(letter);
		if (bucket) {
			bucket.push(note);
		} else {
			buckets.set(letter, [note]);
		}
	}
	return Array.from(buckets.entries())
		.map(([letter, entries]) => ({
			letter,
			notes: entries.sort((a, b) =>
				a.title.localeCompare(b.title, undefined, { numeric: true }),
			),
		}))
		.sort((a, b) => {
			if (a.letter === '#') {
				return b.letter === '#' ? 0 : 1;
			}
			return b.letter === '#' ? -1 : a.letter.localeCompare(b.letter);
		});
}

function initial(title: string): string {
	const first = title.trim().charAt(0).toUpperCase();
	return /[A-Z]/.test(first) ? first : '#';
}

/** Compares titles the way a reader would: case and punctuation do not count. */
function normalise(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * Where a note sits, said as briefly as it can be: the last two things that
 * distinguish it. An index has no hierarchy of its own, so two notes with the
 * same name need this to tell them apart — and the levels above stay unsaid,
 * because every row in the index would repeat them.
 */
export function noteContext(model: VaultModel, note: NoteEntry): string {
	const axes = navAxes(model);
	const parts =
		axes[0] === FOLDER_AXIS
			? note.folder.split('/').filter((part) => part !== '')
			: axes
					.map((axis) => note.facets[axis]?.[0])
					.filter((value): value is string => value !== undefined);
	return parts.slice(-2).join(' / ');
}
