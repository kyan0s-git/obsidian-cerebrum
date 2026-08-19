import { prepareFuzzySearch } from 'obsidian';
import type { GroupKey, NoteEntry, SortKey } from '../types';

/** Above this many notes, search stops looking at tags and aliases. */
const DEEP_SEARCH_LIMIT = 3000;

export interface NoteGroup {
	key: string;
	label: string;
	notes: NoteEntry[];
}

/**
 * Filters notes with Obsidian's own fuzzy matcher over title, path, tags and
 * aliases, keeping the best matches first.
 */
export function searchNotes(notes: NoteEntry[], query: string): NoteEntry[] {
	const trimmed = query.trim();
	if (trimmed === '') {
		return notes;
	}
	const match = prepareFuzzySearch(trimmed);
	// Tags and aliases are worth matching, but not at the cost of a laggy
	// keystroke in a very large vault.
	const deep = notes.length <= DEEP_SEARCH_LIMIT;
	const scored: { note: NoteEntry; score: number }[] = [];
	for (const note of notes) {
		const haystacks = deep
			? [note.title, note.path, ...note.tags, ...note.aliases]
			: [note.title, note.path];
		let best: number | null = null;
		for (const haystack of haystacks) {
			const result = match(haystack);
			if (result && (best === null || result.score > best)) {
				best = result.score;
			}
		}
		if (best !== null) {
			scored.push({ note, score: best });
		}
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.map((entry) => entry.note);
}

export function sortNotes(notes: NoteEntry[], key: SortKey): NoteEntry[] {
	const sorted = [...notes];
	sorted.sort((a, b) => {
		switch (key) {
			case 'oldest':
				return a.modified - b.modified;
			case 'title':
				return a.title.localeCompare(b.title);
			case 'title-desc':
				return b.title.localeCompare(a.title);
			case 'links':
				return (
					linkWeight(b) - linkWeight(a) || a.title.localeCompare(b.title)
				);
			case 'newest':
			default:
				return b.modified - a.modified;
		}
	});
	return sorted;
}

function linkWeight(note: NoteEntry): number {
	return note.incoming.length + note.outgoing.length;
}

export function groupNotes(notes: NoteEntry[], key: GroupKey): NoteGroup[] {
	if (key === 'none') {
		return [{ key: 'all', label: '', notes }];
	}

	const facet = key.startsWith('facet:') ? key.slice('facet:'.length) : null;
	const groups = new Map<string, NoteGroup>();
	const push = (groupKey: string, label: string, note: NoteEntry): void => {
		const existing = groups.get(groupKey);
		if (existing) {
			existing.notes.push(note);
			return;
		}
		groups.set(groupKey, { key: groupKey, label, notes: [note] });
	};

	for (const note of notes) {
		if (facet !== null) {
			const values = note.facets[facet] ?? [];
			if (values.length === 0) {
				push('', `No ${facet}`, note);
			} else {
				for (const value of values) {
					push(value, value, note);
				}
			}
			continue;
		}
		switch (key) {
			case 'folder':
				push(note.folder, note.folder === '' ? 'Vault root' : note.folder, note);
				break;
			case 'modified':
			default: {
				const bucket = dateBucket(note.modified);
				push(bucket.key, bucket.label, note);
				break;
			}
		}
	}

	const ordered = Array.from(groups.values());
	if (facet !== null) {
		// Years read newest first; anything else alphabetically, numbers in order.
		return ordered.sort((a, b) => {
			if (a.key === '') {
				return 1;
			}
			if (b.key === '') {
				return -1;
			}
			if (YEAR_PATTERN.test(a.key) && YEAR_PATTERN.test(b.key)) {
				return b.key.localeCompare(a.key);
			}
			return a.label.localeCompare(b.label, undefined, { numeric: true });
		});
	}
	if (key === 'modified') {
		return ordered.sort(
			(a, b) => DATE_BUCKETS.indexOf(a.key) - DATE_BUCKETS.indexOf(b.key),
		);
	}
	return ordered.sort((a, b) => a.label.localeCompare(b.label));
}

const DATE_BUCKETS = ['today', 'yesterday', 'week', 'month', 'older'];
const YEAR_PATTERN = /^(?:19|20)\d{2}(?:[-/–]\d{2,4})?$/;

function dateBucket(timestamp: number): { key: string; label: string } {
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const day = 24 * 60 * 60 * 1000;
	const age = startOfToday.getTime() - timestamp;

	if (age <= 0) {
		return { key: 'today', label: 'Today' };
	}
	if (age <= day) {
		return { key: 'yesterday', label: 'Yesterday' };
	}
	if (age <= 7 * day) {
		return { key: 'week', label: 'Earlier this week' };
	}
	if (age <= 30 * day) {
		return { key: 'month', label: 'Earlier this month' };
	}
	return { key: 'older', label: 'Older' };
}
