import type { CerebrumSettings } from '../settings';
import type {
	FolderEntry,
	NoteEntry,
	Selection,
	SmartListId,
	UnresolvedEntry,
} from '../types';
import type { VaultModel } from '../core/vault-model';
import { matchesFilters } from '../core/facets';
import { formatFolder } from '../utils/format';

export interface SmartList {
	id: SmartListId;
	label: string;
	icon: string;
	description: string;
}

/**
 * Collections that are computed from the link structure rather than the folder
 * layout. They stay meaningful no matter how the vault is organised.
 */
export const SMART_LISTS: SmartList[] = [
	{
		id: 'all',
		label: 'All notes',
		icon: 'library',
		description: 'Everything in the vault, newest first.',
	},
	{
		id: 'recent',
		label: 'Recently edited',
		icon: 'history',
		description: 'Notes touched in the last few days.',
	},
	{
		id: 'hubs',
		label: 'Link hubs',
		icon: 'network',
		description: 'The notes the rest of the vault points at most.',
	},
	{
		id: 'orphans',
		label: 'Orphans',
		icon: 'unlink',
		description: 'Notes with no links in and no links out.',
	},
	{
		id: 'unresolved',
		label: 'Missing pages',
		icon: 'file-question',
		description: 'Links that do not have a note behind them yet.',
	},
];

export interface Collection {
	title: string;
	description: string;
	icon: string;
	notes: NoteEntry[];
	/** Child folders shown above the notes when browsing a folder. */
	folders: FolderEntry[];
	/** Only populated for the missing pages collection. */
	unresolved: UnresolvedEntry[];
}

/** Attachments only appear when the user asked to see them. */
function visible(notes: NoteEntry[], settings: CerebrumSettings): NoteEntry[] {
	return settings.showAttachments
		? notes
		: notes.filter((note) => note.isNote);
}

/** Keeps only the notes matching every active facet filter. */
export function applyFacets(
	notes: NoteEntry[],
	filters: Record<string, string>,
): NoteEntry[] {
	if (Object.keys(filters).length === 0) {
		return notes;
	}
	return notes.filter((note) => matchesFilters(note.facets, filters));
}

/** Turns the current selection into everything the content area has to draw. */
export function resolveCollection(
	model: VaultModel,
	settings: CerebrumSettings,
	selection: Selection,
): Collection {
	if (selection.kind === 'tag') {
		return {
			title: selection.value,
			description: 'Notes carrying this tag.',
			icon: 'tag',
			notes: visible(model.getNotesWithTag(selection.value), settings),
			folders: [],
			unresolved: [],
		};
	}

	if (selection.kind === 'folder') {
		const folder = model.getFolder(selection.value);
		const recursive = settings.showSubfolderContents;
		return {
			title: folder ? formatFolder(folder.path) : formatFolder(selection.value),
			description: recursive
				? 'This space and everything nested inside it.'
				: 'Notes stored directly in this space.',
			icon: 'folder-open',
			notes: visible(
				model.getNotesInFolder(selection.value, recursive),
				settings,
			),
			folders: model.getChildFolders(selection.value),
			unresolved: [],
		};
	}

	const list =
		SMART_LISTS.find((item) => item.id === selection.value) ?? SMART_LISTS[0];
	const base = {
		title: list?.label ?? 'All notes',
		description: list?.description ?? '',
		icon: list?.icon ?? 'library',
		folders: [] as FolderEntry[],
		unresolved: [] as UnresolvedEntry[],
	};

	switch (selection.value) {
		case 'recent': {
			const cutoff = Date.now() - settings.recentDays * 24 * 60 * 60 * 1000;
			return {
				...base,
				notes: visible(model.getAllNotes(), settings)
					.filter((note) => note.modified >= cutoff)
					.sort((a, b) => b.modified - a.modified),
			};
		}
		case 'hubs':
			return { ...base, notes: visible(model.getHubs(), settings) };
		case 'orphans':
			return { ...base, notes: model.getOrphans() };
		case 'unresolved':
			return { ...base, notes: [], unresolved: model.getUnresolved() };
		case 'all':
		default:
			return { ...base, notes: visible(model.getAllNotes(), settings) };
	}
}

/** Count shown next to a collection in the rail. */
export function countForSmartList(
	model: VaultModel,
	settings: CerebrumSettings,
	id: SmartListId,
): number {
	switch (id) {
		case 'recent': {
			const cutoff = Date.now() - settings.recentDays * 24 * 60 * 60 * 1000;
			return visible(model.getAllNotes(), settings).filter(
				(note) => note.modified >= cutoff,
			).length;
		}
		case 'hubs':
			return visible(model.getHubs(), settings).length;
		case 'orphans':
			return model.getOrphans().length;
		case 'unresolved':
			return model.getUnresolved().length;
		case 'all':
		default:
			return visible(model.getAllNotes(), settings).length;
	}
}
