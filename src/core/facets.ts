/**
 * Levels: the structure a vault already has, read as filters.
 *
 * A second brain encodes several independent things at once, and almost never
 * in one place. A path says `raw/2026/physics/unit-3`. A nested tag says
 * `#status/active`. A property says `type: reference`. All three are the same
 * shape — a named dimension with a small set of repeating values — and all
 * three are useless as long as they can only be walked in the order the folder
 * tree happens to impose.
 *
 * A level is that dimension, whatever it came from:
 *
 * - **path**, named by a pattern such as `raw/<year>/<subject>/<unit>`
 * - **tag**, from the namespace of a nested tag: `#subject/physics`
 * - **property**, from a frontmatter key used consistently across notes
 *
 * Tags and properties name themselves, so they are discovered automatically and
 * a vault gets useful levels without being configured at all. Paths cannot name
 * themselves, so they are the one source that asks for a pattern.
 */

/** Where a level's values came from. */
export type FacetSource = 'path' | 'tag' | 'property';

/** One segment of a path pattern. */
type PatternSegment =
	| { kind: 'literal'; value: string }
	| { kind: 'capture'; name: string }
	| { kind: 'any' }
	| { kind: 'rest' };

export interface FacetRule {
	/** The pattern exactly as the user wrote it. */
	source: string;
	segments: PatternSegment[];
}

/**
 * Level values for one note. A note can sit in several values of the same
 * level, because tags and list properties are naturally plural.
 */
export type FacetValues = Record<string, string[]>;

export interface FacetDefinition {
	name: string;
	source: FacetSource;
	/** Notes carrying at least one value of this level. */
	coverage: number;
}

export interface FacetCount {
	value: string;
	count: number;
}

const YEAR_PATTERN = /^(?:19|20)\d{2}(?:[-/–]\d{2,4})?$/;

/** Names suggested for detected path levels, after any year level. */
const SUGGESTED_NAMES = ['category', 'topic', 'subtopic', 'section'];

/** Frontmatter keys that are Obsidian's own, or prose rather than a category. */
const RESERVED_KEYS = new Set([
	'title',
	'aliases',
	'alias',
	'tags',
	'tag',
	'cssclass',
	'cssclasses',
	'description',
	'summary',
	'abstract',
	'permalink',
	'publish',
	'position',
	'banner',
	'icon',
	'id',
	'uid',
]);

/** A level needs this many notes before it is worth showing. */
const MIN_NOTES = 3;
/** More distinct values than this is an identifier, not a category. */
const MAX_VALUES = 40;
/** Values must repeat: this many distinct values per note at most. */
const MAX_VALUE_RATIO = 0.75;
/** Longer values are prose, not a category. */
const MAX_VALUE_LENGTH = 40;
/** Cap on discovered levels, so the rail cannot fill with noise. */
const MAX_DISCOVERED = 6;

// ---------------------------------------------------------------- path levels

/**
 * Parses pattern lines. Blank lines and `#` comments are ignored, so the
 * settings box can be annotated.
 */
export function parseRules(lines: string[]): FacetRule[] {
	const rules: FacetRule[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('#')) {
			continue;
		}
		const segments: PatternSegment[] = [];
		for (const raw of trimmed.split('/')) {
			const part = raw.trim();
			if (part === '') {
				continue;
			}
			if (part === '**') {
				segments.push({ kind: 'rest' });
				break;
			}
			if (part === '*') {
				segments.push({ kind: 'any' });
				continue;
			}
			const capture = /^<\s*([^>]+?)\s*>$/.exec(part);
			if (capture?.[1]) {
				segments.push({ kind: 'capture', name: capture[1].toLowerCase() });
				continue;
			}
			segments.push({ kind: 'literal', value: part });
		}
		if (segments.length > 0) {
			rules.push({ source: trimmed, segments });
		}
	}
	return rules;
}

/** Level names in the order the patterns declare them. */
export function patternNames(rules: FacetRule[]): string[] {
	const names: string[] = [];
	for (const rule of rules) {
		for (const segment of rule.segments) {
			if (segment.kind === 'capture' && !names.includes(segment.name)) {
				names.push(segment.name);
			}
		}
	}
	return names;
}

/**
 * Matches a note's folder segments against the rules, first match wins.
 *
 * A path deeper than the pattern still matches: anything below the last named
 * level stays part of that level, so a folder someone nests inside a unit does
 * not knock the note out of its unit. A path shallower than the pattern also
 * matches, and simply has no value for the levels it never reaches.
 */
export function matchFolders(
	folders: string[],
	rules: FacetRule[],
): FacetValues | null {
	for (const rule of rules) {
		const values = matchRule(folders, rule);
		if (values) {
			return values;
		}
	}
	return null;
}

function matchRule(folders: string[], rule: FacetRule): FacetValues | null {
	const values: FacetValues = {};
	for (let index = 0; index < rule.segments.length; index++) {
		const segment = rule.segments[index];
		if (!segment || segment.kind === 'rest') {
			break;
		}
		const folder = folders[index];
		if (folder === undefined) {
			// The path ran out before the pattern did: the remaining levels are
			// simply absent for this note, which is not a failure to match.
			break;
		}
		if (segment.kind === 'literal') {
			if (segment.value.toLowerCase() !== folder.toLowerCase()) {
				return null;
			}
			continue;
		}
		if (segment.kind === 'capture') {
			values[segment.name] = [folder];
		}
	}
	return values;
}

// ----------------------------------------------------------- tags, properties

/** The namespace and value of a nested tag, or null for a flat one. */
export function splitTag(tag: string): { name: string; value: string } | null {
	const parts = tag.replace(/^#/, '').split('/');
	const name = parts[0];
	const value = parts[1];
	if (parts.length < 2 || !name || !value) {
		return null;
	}
	return { name: name.toLowerCase(), value };
}

/** Values a frontmatter entry contributes, if it looks like a category. */
export function propertyValues(value: unknown): string[] {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed === '' || trimmed.length > MAX_VALUE_LENGTH
			? []
			: [trimmed];
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return [String(value)];
	}
	if (typeof value === 'boolean') {
		return [value ? 'yes' : 'no'];
	}
	if (Array.isArray(value)) {
		const values: string[] = [];
		for (const item of value) {
			values.push(...propertyValues(item));
		}
		return values;
	}
	return [];
}

/** What a note offers to discovery, before any level has been chosen. */
export interface FacetCandidateSource {
	tags: string[];
	frontmatter: Record<string, unknown> | undefined;
}

/**
 * Finds the levels a vault already has. A candidate qualifies when its values
 * repeat across enough notes to be worth filtering by, and stays out when it
 * looks like an identifier, a date stamp or a sentence.
 */
export function discoverFacets(
	notes: FacetCandidateSource[],
	options: { exclude?: string[]; limit?: number } = {},
): FacetDefinition[] {
	const excluded = new Set(
		(options.exclude ?? []).map((name) => name.toLowerCase()),
	);
	const tally = new Map<
		string,
		{ source: FacetSource; values: Map<string, number>; notes: number }
	>();

	const add = (
		name: string,
		source: FacetSource,
		values: string[],
	): void => {
		if (values.length === 0 || excluded.has(name)) {
			return;
		}
		const entry = tally.get(name) ?? {
			source,
			values: new Map<string, number>(),
			notes: 0,
		};
		entry.notes += 1;
		for (const value of new Set(values)) {
			entry.values.set(value, (entry.values.get(value) ?? 0) + 1);
		}
		tally.set(name, entry);
	};

	for (const note of notes) {
		for (const tag of note.tags) {
			const split = splitTag(tag);
			if (split) {
				add(split.name, 'tag', [split.value]);
			}
		}
		for (const [key, raw] of Object.entries(note.frontmatter ?? {})) {
			const name = key.toLowerCase();
			if (RESERVED_KEYS.has(name)) {
				continue;
			}
			add(name, 'property', propertyValues(raw));
		}
	}

	const definitions: FacetDefinition[] = [];
	for (const [name, entry] of tally) {
		const distinct = entry.values.size;
		if (entry.notes < MIN_NOTES || distinct < 2 || distinct > MAX_VALUES) {
			continue;
		}
		if (distinct / entry.notes > MAX_VALUE_RATIO) {
			continue;
		}
		definitions.push({ name, source: entry.source, coverage: entry.notes });
	}

	return definitions
		.sort((a, b) => b.coverage - a.coverage || a.name.localeCompare(b.name))
		.slice(0, options.limit ?? MAX_DISCOVERED);
}

/** Values a note contributes to one discovered level. */
export function valuesForDiscovered(
	definition: FacetDefinition,
	source: FacetCandidateSource,
): string[] {
	if (definition.source === 'tag') {
		const values: string[] = [];
		for (const tag of source.tags) {
			const split = splitTag(tag);
			if (split && split.name === definition.name) {
				values.push(split.value);
			}
		}
		return values;
	}
	for (const [key, raw] of Object.entries(source.frontmatter ?? {})) {
		if (key.toLowerCase() === definition.name) {
			return propertyValues(raw);
		}
	}
	return [];
}

// -------------------------------------------------------------- combining all

/**
 * Every level value for one note. The path is the base, a frontmatter property
 * of the same name replaces it — the escape hatch for a note filed somewhere
 * its path does not describe — and tags add to it.
 */
export function facetsForNote(
	folders: string[],
	source: FacetCandidateSource,
	rules: FacetRule[],
	discovered: FacetDefinition[],
): FacetValues {
	const values: FacetValues = matchFolders(folders, rules) ?? {};

	for (const name of patternNames(rules)) {
		const override = propertyLookup(source.frontmatter, name);
		if (override.length > 0) {
			values[name] = override;
		}
	}

	for (const definition of discovered) {
		const found = valuesForDiscovered(definition, source);
		if (found.length === 0) {
			continue;
		}
		if (definition.source === 'property') {
			values[definition.name] = unique(found);
			continue;
		}
		values[definition.name] = unique([
			...(values[definition.name] ?? []),
			...found,
		]);
	}
	return values;
}

function propertyLookup(
	frontmatter: Record<string, unknown> | undefined,
	name: string,
): string[] {
	for (const [key, raw] of Object.entries(frontmatter ?? {})) {
		if (key.toLowerCase() === name) {
			return propertyValues(raw);
		}
	}
	return [];
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

/** The first value of a level, for places that can only show one. */
export function firstValue(
	values: FacetValues,
	name: string,
): string | undefined {
	return values[name]?.[0];
}

/** True when a note matches every active filter. */
export function matchesFilters(
	values: FacetValues,
	filters: Record<string, string>,
): boolean {
	for (const [name, wanted] of Object.entries(filters)) {
		if (!values[name]?.includes(wanted)) {
			return false;
		}
	}
	return true;
}

/**
 * Counts the values of one level across notes, applying every *other* active
 * filter. Counting that way is what makes a level narrow as you drill in while
 * still letting you switch to a sibling value in one click.
 */
export function countValues(
	notes: { facets: FacetValues }[],
	name: string,
	filters: Record<string, string>,
): FacetCount[] {
	const others: Record<string, string> = { ...filters };
	delete others[name];

	const counts = new Map<string, number>();
	for (const note of notes) {
		if (!matchesFilters(note.facets, others)) {
			continue;
		}
		for (const value of note.facets[name] ?? []) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return Array.from(counts.entries())
		.map(([value, count]) => ({ value, count }))
		.sort(compareValues);
}

/** Years descend (newest first), everything else reads alphabetically. */
function compareValues(a: FacetCount, b: FacetCount): number {
	const aYear = YEAR_PATTERN.test(a.value);
	const bYear = YEAR_PATTERN.test(b.value);
	if (aYear && bYear) {
		return b.value.localeCompare(a.value);
	}
	return a.value.localeCompare(b.value, undefined, { numeric: true });
}

export function isYearLike(value: string): boolean {
	return YEAR_PATTERN.test(value);
}

// ------------------------------------------------------------ path detection

/**
 * Guesses patterns from the vault's own shape, one per top level folder, so the
 * settings box starts from something real that the user can rename. A level
 * whose values look like years is named `year`; the rest take names in order.
 */
export function detectRules(folderPaths: string[], maxDepth = 4): string[] {
	const trees = new Map<string, string[][]>();
	for (const path of folderPaths) {
		const segments = path.split('/').filter((segment) => segment !== '');
		const top = segments[0];
		if (top === undefined) {
			continue;
		}
		const list = trees.get(top) ?? [];
		list.push(segments);
		trees.set(top, list);
	}

	const patterns: string[] = [];
	for (const [top, paths] of Array.from(trees.entries()).sort()) {
		const depth = Math.min(
			maxDepth,
			paths.reduce((max, segments) => Math.max(max, segments.length), 0),
		);
		const names: string[] = [];
		let suggestion = 0;
		for (let level = 1; level < depth; level++) {
			const values = new Set<string>();
			for (const segments of paths) {
				const value = segments[level];
				if (value !== undefined) {
					values.add(value);
				}
			}
			if (values.size === 0) {
				continue;
			}
			if (looksLikeYears(values) && !names.includes('year')) {
				names.push('year');
				continue;
			}
			names.push(SUGGESTED_NAMES[suggestion] ?? `level${level}`);
			suggestion++;
		}
		if (names.length === 0) {
			continue;
		}
		patterns.push(`${top}/${names.map((name) => `<${name}>`).join('/')}`);
	}
	return patterns;
}

function looksLikeYears(values: Set<string>): boolean {
	if (values.size === 0) {
		return false;
	}
	let years = 0;
	for (const value of values) {
		if (YEAR_PATTERN.test(value)) {
			years++;
		}
	}
	return years / values.size >= 0.6;
}
