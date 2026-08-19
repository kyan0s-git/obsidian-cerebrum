/**
 * Facets: the folder path, read as meaning rather than as a location.
 *
 * A second brain usually encodes several independent things in one path —
 * `raw/2026/physics/unit-3/notes.md` says where the note came from, when it is
 * from, what it is about, and which part of the subject it belongs to. A folder
 * tree can only be walked in that fixed order, which is why the top level alone
 * is nondescript: `raw` and `wiki` are a *source*, orthogonal to everything you
 * actually want to browse by.
 *
 * A pattern names each level once:
 *
 *     raw/<year>/<subject>/<unit>
 *     wiki/<year>/<subject>/<unit>
 *
 * and from then on every note carries `year`, `subject` and `unit` as
 * independent filters that can be combined in any order, across every tree.
 */

/** One segment of a pattern. */
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

/** Facet values for one note, keyed by facet name. */
export type FacetValues = Record<string, string>;

/** A facet value and how many notes carry it. */
export interface FacetCount {
	value: string;
	count: number;
}

const YEAR_PATTERN = /^(?:19|20)\d{2}(?:[-/–]\d{2,4})?$/;

/** Names suggested for detected levels, in order, after any year level. */
const SUGGESTED_NAMES = ['subject', 'unit', 'topic', 'section'];

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

/** Facet names in the order they first appear across the rules. */
export function facetNames(rules: FacetRule[]): string[] {
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
			values[segment.name] = folder;
		}
	}
	return values;
}

/**
 * Facet values for a note. Frontmatter wins over the path, so a note filed in
 * the wrong place, or one that belongs to two subjects, can say so itself
 * without being moved.
 */
export function facetsForNote(
	folders: string[],
	frontmatter: Record<string, unknown> | undefined,
	rules: FacetRule[],
	names: string[],
): FacetValues {
	const values = matchFolders(folders, rules) ?? {};
	if (!frontmatter) {
		return values;
	}
	for (const name of names) {
		const override = readFacetValue(frontmatter, name);
		if (override !== undefined) {
			values[name] = override;
		}
	}
	return values;
}

function readFacetValue(
	frontmatter: Record<string, unknown>,
	name: string,
): string | undefined {
	for (const key of Object.keys(frontmatter)) {
		if (key.toLowerCase() !== name) {
			continue;
		}
		const value = frontmatter[key];
		if (typeof value === 'string' && value.trim() !== '') {
			return value.trim();
		}
		if (typeof value === 'number' && Number.isFinite(value)) {
			return String(value);
		}
	}
	return undefined;
}

/** True when a note matches every active facet filter. */
export function matchesFilters(
	values: FacetValues,
	filters: FacetValues,
): boolean {
	for (const [name, wanted] of Object.entries(filters)) {
		if (values[name] !== wanted) {
			return false;
		}
	}
	return true;
}

/**
 * Counts the values of one facet across notes, applying every *other* active
 * filter. Counting that way is what makes a facet list narrow as you drill in
 * while still letting you switch to a sibling value in one click.
 */
export function countValues(
	notes: { facets: FacetValues }[],
	name: string,
	filters: FacetValues,
): FacetCount[] {
	const others: FacetValues = { ...filters };
	delete others[name];

	const counts = new Map<string, number>();
	for (const note of notes) {
		if (!matchesFilters(note.facets, others)) {
			continue;
		}
		const value = note.facets[name];
		if (value === undefined) {
			continue;
		}
		counts.set(value, (counts.get(value) ?? 0) + 1);
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
