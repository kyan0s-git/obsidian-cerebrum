import type { GroupKey, SortKey, ViewMode } from './types';

export interface CerebrumSettings {
	/** Explorer */
	openInNewTab: boolean;
	viewMode: ViewMode;
	sortKey: SortKey;
	sortDescending: boolean;
	groupKey: GroupKey;
	showExcerpts: boolean;
	showAttachments: boolean;
	showSubfolderContents: boolean;
	recentDays: number;
	/** Folder paths hidden from every view, one per line. */
	excludedFolders: string[];
	/** Patterns naming the folder levels, one per line. */
	facetPatterns: string[];
	/** Discover levels from nested tags and frontmatter properties. */
	autoFacets: boolean;
	/** Level names to leave out, one per line. */
	hiddenFacets: string[];

	/** Graph */
	graphIncludeAttachments: boolean;
	graphIncludeUnresolved: boolean;
	graphIncludeOrphans: boolean;
	graphShowArrows: boolean;
	graphShowLabels: boolean;
	graphLocalDepth: number;
	graphLinkDistance: number;
	graphRepelStrength: number;
	graphCenterStrength: number;
	graphMaxNodes: number;
	/** Facet name used for node colour, or an empty string for the folder. */
	graphColorBy: string;
}

export const DEFAULT_SETTINGS: CerebrumSettings = {
	openInNewTab: false,
	viewMode: 'cards',
	sortKey: 'modified',
	sortDescending: true,
	groupKey: 'none',
	showExcerpts: true,
	showAttachments: false,
	showSubfolderContents: false,
	recentDays: 14,
	excludedFolders: [],
	facetPatterns: [],
	autoFacets: true,
	hiddenFacets: [],

	graphIncludeAttachments: false,
	graphIncludeUnresolved: true,
	graphIncludeOrphans: true,
	graphShowArrows: true,
	graphShowLabels: true,
	graphLocalDepth: 1,
	graphLinkDistance: 90,
	graphRepelStrength: 900,
	graphCenterStrength: 0.05,
	graphMaxNodes: 2000,
	graphColorBy: '',
};

/** Merges stored data over the defaults, dropping anything unrecognised. */
export function mergeSettings(stored: unknown): CerebrumSettings {
	const settings: CerebrumSettings = { ...DEFAULT_SETTINGS };
	if (stored === null || typeof stored !== 'object') {
		return settings;
	}
	const storedRecord = stored as Record<string, unknown>;
	const target = settings as unknown as Record<string, unknown>;
	for (const key of Object.keys(DEFAULT_SETTINGS)) {
		const value = storedRecord[key];
		if (value === undefined) {
			continue;
		}
		const fallback = DEFAULT_SETTINGS[key as keyof CerebrumSettings];
		if (Array.isArray(fallback)) {
			if (Array.isArray(value)) {
				target[key] = value.filter(
					(item): item is string => typeof item === 'string',
				);
			}
			continue;
		}
		if (typeof value === typeof fallback) {
			target[key] = value;
		}
	}
	return settings;
}
