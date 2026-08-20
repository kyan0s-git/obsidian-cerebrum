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
	/** The step taken by opening this child. */
	step: TrailStep;
	noteCount: number;
	/** True when this child has children of its own. */
	hasChildren: boolean;
}

export interface NavPlace {
	/** Every step back to the start, innermost last. */
	crumbs: { label: string; trail: TrailStep[] }[];
	title: string;
	/** What one level down is called here: "Units", "Folders". */
	childLabel: string;
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

	const crumbs = [{ label: 'Home', trail: [] as TrailStep[] }];
	for (let index = 0; index < trail.length; index++) {
		const step = trail[index];
		if (!step) {
			continue;
		}
		crumbs.push({
			label: folderMode ? lastSegment(step.value) : step.value,
			trail: trail.slice(0, index + 1),
		});
	}

	const children = folderMode
		? folderChildren(model, settings, trail)
		: levelChildren(model, settings, trail, axes, allNotes);

	const inChild = new Set<string>();
	for (const child of children) {
		for (const note of notesForTrail(model, settings, [...trail, child.step])) {
			inChild.add(note.path);
		}
	}

	const last = trail[trail.length - 1];
	return {
		crumbs,
		title: last ? (folderMode ? lastSegment(last.value) : last.value) : 'Home',
		childLabel: folderMode
			? 'Folders'
			: plural(axes[trail.length] ?? ''),
		children,
		notes: allNotes.filter((note) => !inChild.has(note.path)),
		allNotes,
	};
}

/** Values of the next level, among the notes that are actually here. */
function levelChildren(
	model: VaultModel,
	settings: CerebrumSettings,
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
			step: { name, value },
			noteCount,
			hasChildren: hasDeeper,
		}))
		.sort((a, b) => compareLabels(a.label, b.label));
}

function folderChildren(
	model: VaultModel,
	settings: CerebrumSettings,
	trail: TrailStep[],
): NavChild[] {
	const here = trail[trail.length - 1]?.value ?? '';
	return model.getChildFolders(here).map((folder: FolderEntry) => ({
		label: folder.name,
		step: { name: FOLDER_AXIS, value: folder.path },
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

function lastSegment(path: string): string {
	return path.split('/').pop() ?? path;
}

/** "unit" describes one, "Units" heads a list of them. */
function plural(name: string): string {
	if (name === '') {
		return '';
	}
	const capitalised = name.charAt(0).toUpperCase() + name.slice(1);
	if (capitalised.endsWith('s')) {
		return capitalised;
	}
	return capitalised.endsWith('y')
		? `${capitalised.slice(0, -1)}ies`
		: `${capitalised}s`;
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
