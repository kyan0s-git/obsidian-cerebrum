/** View type registered for the content browser. */
export const EXPLORER_VIEW_TYPE = 'cerebrum-explorer';

/** View type registered for the link graph. */
export const GRAPH_VIEW_TYPE = 'cerebrum-graph';

export const EXPLORER_ICON = 'layout-dashboard';
export const GRAPH_ICON = 'git-fork';

/** How long vault changes are collected before the index is rebuilt. */
export const INDEX_DEBOUNCE_MS = 400;

/** Number of items rendered before the "load more" control appears. */
export const PAGE_SIZE = 60;

/** Maximum length of the plain text excerpt shown on a card. */
export const EXCERPT_LENGTH = 220;

/** Files above this size are never read for an excerpt. */
export const EXCERPT_MAX_FILE_SIZE = 512 * 1024;

/** Extensions Obsidian treats as notes rather than attachments. */
export const NOTE_EXTENSIONS = new Set(['md', 'canvas']);
