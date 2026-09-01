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
	/**
	 * `<shelf=raw>`: matches only this folder, and records it as a value of the
	 * level. It is what lets several trees of the same shape be described as one
	 * hierarchy — `raw/`, `personal/` and `wiki/` are not three subjects, they
	 * are three kinds of material about the same subjects.
	 */
	| { kind: 'pin'; name: string; value: string }
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

/**
 * Names suggested for detected path levels, after any year level. Concrete
 * words a reader can picture, because they become the headings: "Subjects",
 * "Units". "Category" and "topic" describe the machinery, not the vault.
 */
const SUGGESTED_NAMES = ['subject', 'unit', 'section', 'part'];

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
	'created',
	'updated',
	'modified',
	'date',
	'datetime',
	'timestamp',
]);

/** A value that is a date is a point in time, not a category to browse by. */
const DATE_VALUE = /^\d{4}-\d{2}-\d{2}([T ]|$)|^\d{2}[/-]\d{2}[/-]\d{4}$/;

/** A level needs this many notes before it is worth showing. */
const MIN_NOTES = 3;
/** More distinct values than this is an identifier, not a category. */
const MAX_VALUES = 40;
/** Values must repeat: this many distinct values per note at most. */
const MAX_VALUE_RATIO = 0.75;
/** Longer values are prose, not a category. */
const MAX_VALUE_LENGTH = 40;
/** Cap on discovered levels, so the rail cannot fill with noise. */
const MAX_DISCOVERED = 4;

/** Two levels agreeing on this share of notes are the same dimension twice. */
const SAME_DIMENSION = 0.8;

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
			const capture = /^<\s*([^=>]+?)\s*(?:=\s*([^>]+?)\s*)?>$/.exec(part);
			if (capture?.[1]) {
				const name = capture[1].toLowerCase();
				const pinned = capture[2];
				segments.push(
					pinned === undefined
						? { kind: 'capture', name }
						: { kind: 'pin', name, value: pinned },
				);
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

/**
 * Level names in the order they are walked.
 *
 * Levels every rule declares come first: those are the hierarchy itself, and
 * they are the same wherever you enter it. Pinned levels come next, however
 * early in the path they sit, because they name a fixed countable set — there
 * will only ever be three shelves — and a hierarchy that opens by asking which
 * shelf you want has answered nothing.
 *
 * Levels only some rules declare come last, after the pin. A level that exists
 * inside one tree cannot be asked about before you know which tree you are in:
 * `sources` and `papers` are both "kind", and offering them together, before
 * the shelf that tells them apart, is the confusion this ordering exists to
 * prevent.
 */
export function patternNames(rules: FacetRule[]): string[] {
	const order: string[] = [];
	const pinned: string[] = [];
	/** Free level names by the position they hold among a rule's captures. */
	const atPosition: Map<number, Set<string>> = new Map();
	const declaring = new Map<string, number>();

	for (const rule of rules) {
		let position = 0;
		const seen = new Set<string>();
		for (const segment of rule.segments) {
			if (segment.kind === 'pin') {
				if (!pinned.includes(segment.name)) {
					pinned.push(segment.name);
				}
				continue;
			}
			if (segment.kind !== 'capture') {
				continue;
			}
			if (!order.includes(segment.name)) {
				order.push(segment.name);
			}
			if (!seen.has(segment.name)) {
				seen.add(segment.name);
				declaring.set(segment.name, (declaring.get(segment.name) ?? 0) + 1);
			}
			const names = atPosition.get(position) ?? new Set<string>();
			names.add(segment.name);
			atPosition.set(position, names);
			position++;
		}
	}

	/** True when the rules disagree about what belongs at this level's place. */
	const contested = (name: string): boolean => {
		for (const names of atPosition.values()) {
			if (names.has(name) && names.size > 1) {
				return true;
			}
		}
		return false;
	};
	// Declared by every rule, or nothing else claims its place: hierarchy.
	const early = (name: string): boolean =>
		declaring.get(name) === rules.length || !contested(name);

	return [
		...order.filter(early),
		...pinned.filter((name) => !order.includes(name)),
		...order.filter((name) => !early(name)),
	];
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
		if (segment.kind === 'pin') {
			if (segment.value.toLowerCase() !== folder.toLowerCase()) {
				return null;
			}
			values[segment.name] = [folder];
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
		if (trimmed === '' || trimmed.length > MAX_VALUE_LENGTH) {
			return [];
		}
		return DATE_VALUE.test(trimmed) ? [] : [trimmed];
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

/**
 * Drops levels that say the same thing as another one.
 *
 * A folder pattern and a property often describe one dimension in two
 * vocabularies — `category` from a path and `class` from frontmatter, holding
 * the same values for the same notes. Keeping both is the same filter listed
 * twice. When two levels agree on what they put where, the one named by the
 * user wins over one a pattern invented, and wider coverage breaks a tie.
 */
export function dedupeFacets(
	definitions: FacetDefinition[],
	notes: { facets: FacetValues }[],
): FacetDefinition[] {
	const kept: FacetDefinition[] = [];
	for (const candidate of definitions) {
		const twin = kept.find((existing) =>
			sameDimension(existing.name, candidate.name, notes),
		);
		if (!twin) {
			kept.push(candidate);
			continue;
		}
		if (preferred(candidate, twin) === candidate) {
			kept[kept.indexOf(twin)] = candidate;
		}
	}
	return kept;
}

/** The level whose name came from the user, or failing that the wider one. */
function preferred(a: FacetDefinition, b: FacetDefinition): FacetDefinition {
	if (a.source !== 'path' && b.source === 'path') {
		return a;
	}
	if (b.source !== 'path' && a.source === 'path') {
		return b;
	}
	return a.coverage > b.coverage ? a : b;
}

function sameDimension(
	left: string,
	right: string,
	notes: { facets: FacetValues }[],
): boolean {
	let both = 0;
	let agreed = 0;
	for (const note of notes) {
		const a = note.facets[left];
		const b = note.facets[right];
		if (!a && !b) {
			continue;
		}
		both++;
		if (a && b && a.join('\u0000') === b.join('\u0000')) {
			agreed++;
		}
	}
	return both > 0 && agreed / both >= SAME_DIMENSION;
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
 * Reads the shape of a vault's folders and proposes patterns for it.
 *
 * See `clusterCells` for why the trees are aligned by the names they use
 * rather than by how deep those names sit.
 */
export function detectRules(folderPaths: string[], maxDepth = 6): string[] {
	const trees = new Map<string, string[][]>();
	for (const path of folderPaths) {
		const segments = path.split('/').filter((segment) => segment !== '');
		const top = segments[0];
		if (top === undefined || segments.length < 2) {
			continue;
		}
		const list = trees.get(top) ?? [];
		list.push(segments);
		trees.set(top, list);
	}
	if (trees.size === 0) {
		return [];
	}

	const cells = collectCells(trees, maxDepth);
	const levels = clusterCells(cells);
	nameLevels(levels, cells);
	return writeRules(trees, levels, maxDepth);
}

/** The set of folder names one tree uses at one depth. */
interface Cell {
	root: string;
	depth: number;
	values: Set<string>;
}

/** A level: the cells across trees that are filled from the same vocabulary. */
interface Level {
	cells: Cell[];
	values: Set<string>;
	name: string;
}

function collectCells(
	trees: Map<string, string[][]>,
	maxDepth: number,
): Cell[] {
	const cells: Cell[] = [];
	for (const [root, paths] of trees) {
		for (let depth = 1; depth <= maxDepth; depth++) {
			const values = new Set<string>();
			for (const segments of paths) {
				const value = segments[depth];
				if (value !== undefined) {
					values.add(value);
				}
			}
			if (values.size > 0) {
				cells.push({ root, depth, values });
			}
		}
	}
	return cells;
}

/** Two folder vocabularies this alike are the same level, wherever they sit. */
const SAME_LEVEL = 0.4;

/**
 * Groups cells into levels by the names they are filled with.
 *
 * Depth is the wrong thing to align trees by. `raw/<year>/<class>/unit-1` and
 * `wiki/<year>/<class>/sources/unit-1` describe the same unit, and aligning
 * those two trees by depth files `sources` and `unit-1` as the same kind of
 * thing — which is exactly how a folder of summaries ends up looking like a
 * sibling of a unit. What actually identifies a level is the vocabulary it
 * draws on: the units are wherever `unit-1` appears.
 */
function clusterCells(cells: Cell[]): Level[] {
	const levels: Level[] = [];
	for (const cell of [...cells].sort((a, b) => a.depth - b.depth)) {
		const match = levels.find(
			(level) =>
				!level.cells.some((other) => other.root === cell.root) &&
				overlap(level.values, cell.values) >= SAME_LEVEL,
		);
		if (match) {
			match.cells.push(cell);
			for (const value of cell.values) {
				match.values.add(value);
			}
			continue;
		}
		levels.push({ cells: [cell], values: new Set(cell.values), name: '' });
	}
	return levels;
}

/** How much of the smaller vocabulary the two share. */
function overlap(a: Set<string>, b: Set<string>): number {
	const smaller = a.size <= b.size ? a : b;
	const larger = smaller === a ? b : a;
	if (smaller.size === 0) {
		return 0;
	}
	let shared = 0;
	for (const value of smaller) {
		if (larger.has(value)) {
			shared++;
		}
	}
	return shared / smaller.size;
}

/**
 * Levels every tree shares are the hierarchy and get named for what they are.
 * A level only one tree has is that tree's own way of filing things, so they
 * all become one "kind" level, sorted after the shared ones by the rule that a
 * kind of material is a refinement of a place, not a place of its own.
 */
function nameLevels(levels: Level[], cells: Cell[]): void {
	const shared = levels
		.filter((level) => level.cells.length > 1 || isUncontested(level, cells))
		.sort((a, b) => minDepth(a) - minDepth(b));
	let suggestion = 0;
	let years = false;
	for (const level of shared) {
		if (!years && looksLikeYears(level.values)) {
			level.name = 'year';
			years = true;
			continue;
		}
		level.name = SUGGESTED_NAMES[suggestion] ?? `level${suggestion + 1}`;
		suggestion++;
	}
	for (const level of levels) {
		if (level.name === '') {
			level.name = 'kind';
		}
	}
}

/**
 * True when no other tree files anything at this depth at all. One tree simply
 * reaching deeper than the others is still the hierarchy — it is only a kind of
 * material when another tree puts something *different* in the same place.
 */
function isUncontested(level: Level, cells: Cell[]): boolean {
	return !cells.some(
		(cell) =>
			!level.cells.includes(cell) &&
			level.cells.some(
				(own) => own.depth === cell.depth && own.root !== cell.root,
			),
	);
}

function minDepth(level: Level): number {
	return level.cells.reduce((min, cell) => Math.min(min, cell.depth), Infinity);
}

/** One rule per tree, with the tree itself pinned as the level that sorts last. */
function writeRules(
	trees: Map<string, string[][]>,
	levels: Level[],
	maxDepth: number,
): string[] {
	const rules: string[] = [];
	// A pin with one possible value is a question with one answer.
	const pin = trees.size > 1;
	for (const root of Array.from(trees.keys()).sort()) {
		const parts: string[] = [pin ? `<shelf=${root}>` : root];
		let deepest = 0;
		for (let depth = 1; depth <= maxDepth; depth++) {
			const level = levels.find((entry) =>
				entry.cells.some((cell) => cell.root === root && cell.depth === depth),
			);
			if (!level) {
				break;
			}
			parts.push(`<${level.name}>`);
			deepest = depth;
		}
		if (deepest === 0) {
			continue;
		}
		rules.push(`${parts.join('/')}/**`);
	}
	return rules;
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
