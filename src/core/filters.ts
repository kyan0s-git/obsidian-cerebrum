import { prepareFuzzySearch } from 'obsidian';
import type { NoteEntry, SortKey } from '../types';

/** Above this many notes, search stops looking at tags and aliases. */
const DEEP_SEARCH_LIMIT = 3000;

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
