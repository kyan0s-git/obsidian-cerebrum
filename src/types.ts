/** How a note points at another page. */
export type LinkKind = 'link' | 'embed' | 'frontmatter';

/** A single outgoing reference found in a page. */
export interface LinkRef {
	/** Vault path of the target, or the raw link text when unresolved. */
	target: string;
	kind: LinkKind;
	resolved: boolean;
	/** Text the link is displayed as, when it differs from the target. */
	display: string;
}

/** An indexed vault file with everything the views need to render it. */
export interface NoteEntry {
	path: string;
	basename: string;
	extension: string;
	/** Parent folder path, empty string for the vault root. */
	folder: string;
	/** Top level folder the note lives in, empty string for root notes. */
	space: string;
	title: string;
	summary: string;
	tags: string[];
	aliases: string[];
	created: number;
	modified: number;
	size: number;
	isNote: boolean;
	outgoing: LinkRef[];
	/** Paths of files that link to this one. */
	incoming: string[];
}

/** A folder discovered in the vault, with recursive counts. */
export interface FolderEntry {
	path: string;
	name: string;
	parent: string;
	depth: number;
	childFolders: string[];
	/** Files directly inside this folder. */
	directCount: number;
	/** Files inside this folder and all of its descendants. */
	totalCount: number;
	modified: number;
}

/** An unresolved link target, grouped by the text that was written. */
export interface UnresolvedEntry {
	name: string;
	sources: string[];
}

export type ViewMode = 'cards' | 'list';
export type SortKey = 'modified' | 'created' | 'name' | 'links';
export type GroupKey = 'none' | 'folder' | 'space' | 'tag' | 'modified';

/** Built in collections that do not map to a single folder. */
export type SmartListId = 'all' | 'recent' | 'hubs' | 'orphans' | 'unresolved';

/** What the explorer is currently showing. */
export type Selection =
	| { kind: 'folder'; value: string }
	| { kind: 'smart'; value: SmartListId }
	| { kind: 'tag'; value: string };
