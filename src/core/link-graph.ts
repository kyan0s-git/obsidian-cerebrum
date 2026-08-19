import type { LinkKind, NoteEntry } from '../types';
import { firstValue, matchesFilters } from './facets';
import type { VaultModel } from './vault-model';

export type GraphNodeKind = 'note' | 'attachment' | 'ghost';

export interface GraphNode {
	id: string;
	label: string;
	kind: GraphNodeKind;
	/** Vault path for real files, empty for unresolved ghosts. */
	path: string;
	/** Top level folder, used for grouping in the legend. */
	space: string;
	/** What the node is coloured by: a facet value, or the top level folder. */
	colorKey: string;
	inDegree: number;
	outDegree: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Pinned by a drag, ignored by the simulation while true. */
	pinned: boolean;
}

export interface GraphEdge {
	source: string;
	target: string;
	kind: LinkKind;
	resolved: boolean;
	/** True when both pages link to each other. */
	mutual: boolean;
}

export interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
	/** Nodes dropped because the graph hit the node ceiling. */
	truncated: number;
}

export interface GraphOptions {
	includeAttachments: boolean;
	includeUnresolved: boolean;
	includeOrphans: boolean;
	maxNodes: number;
	/** When set, only this note and its neighbourhood are included. */
	focusPath: string | null;
	depth: number;
	/** Case insensitive filter on path, title and tags. */
	query: string;
	/** Facet whose value colours the nodes, or '' for the top level folder. */
	colorBy: string;
	/** Facet filters the graph is restricted to. */
	facets: Record<string, string>;
}

/** Prefix that keeps ghost node ids from colliding with vault paths. */
const GHOST_PREFIX = 'unresolved:';

export function ghostId(name: string): string {
	return GHOST_PREFIX + name.toLowerCase();
}

/**
 * Builds the graph straight from each page's own references, so an edge exists
 * exactly when a page links to, embeds, or names another page. Direction is
 * preserved, and links to pages that do not exist yet become ghost nodes.
 */
export function buildGraph(
	model: VaultModel,
	options: GraphOptions,
): GraphData {
	const included = new Map<string, NoteEntry>();
	for (const note of model.getAllNotes()) {
		if (!options.includeAttachments && !note.isNote) {
			continue;
		}
		included.set(note.path, note);
	}

	const nodes = new Map<string, GraphNode>();
	const edges: GraphEdge[] = [];
	const edgeKeys = new Set<string>();
	let truncated = 0;

	const addNote = (note: NoteEntry): GraphNode | undefined => {
		const existing = nodes.get(note.path);
		if (existing) {
			return existing;
		}
		if (nodes.size >= options.maxNodes) {
			truncated += 1;
			return undefined;
		}
		const node = makeNode(
			note.path,
			note.title,
			note.isNote ? 'note' : 'attachment',
			note.path,
			note.space,
			colorKeyFor(note, options.colorBy),
		);
		nodes.set(node.id, node);
		return node;
	};

	const addGhost = (name: string): GraphNode | undefined => {
		const id = ghostId(name);
		const existing = nodes.get(id);
		if (existing) {
			return existing;
		}
		if (nodes.size >= options.maxNodes) {
			truncated += 1;
			return undefined;
		}
		const node = makeNode(id, name, 'ghost', '', '', '');
		nodes.set(id, node);
		return node;
	};

	const scope = resolveScope(included, options);
	// Edges only connect pages that survived the scope, so a depth of one stays
	// a depth of one and a filter never drags neighbours back in.
	const inScope = new Set(scope.map((note) => note.path));
	for (const note of scope) {
		addNote(note);
	}

	for (const note of scope) {
		const source = nodes.get(note.path);
		if (!source) {
			continue;
		}
		for (const link of note.outgoing) {
			let target: GraphNode | undefined;
			if (link.resolved) {
				const targetNote = included.get(link.target);
				if (!targetNote || !inScope.has(targetNote.path)) {
					continue;
				}
				target = addNote(targetNote);
			} else if (options.includeUnresolved) {
				target = addGhost(link.target);
			}
			if (!target) {
				continue;
			}
			const key = `${source.id} ${target.id} ${link.kind}`;
			if (edgeKeys.has(key)) {
				continue;
			}
			edgeKeys.add(key);
			edges.push({
				source: source.id,
				target: target.id,
				kind: link.kind,
				resolved: link.resolved,
				mutual: false,
			});
			source.outDegree += 1;
			target.inDegree += 1;
		}
	}

	markMutualEdges(edges);

	if (options.includeOrphans) {
		return { nodes: Array.from(nodes.values()), edges, truncated };
	}

	const connected = Array.from(nodes.values()).filter(
		(node) => node.inDegree > 0 || node.outDegree > 0,
	);
	const keep = new Set(connected.map((node) => node.id));
	return {
		nodes: connected,
		edges: edges.filter(
			(edge) => keep.has(edge.source) && keep.has(edge.target),
		),
		truncated,
	};
}

/** Colour key: the chosen facet's value, falling back to the top level folder. */
function colorKeyFor(note: NoteEntry, colorBy: string): string {
	if (colorBy === '') {
		return note.space;
	}
	return firstValue(note.facets, colorBy) ?? '';
}

function makeNode(
	id: string,
	label: string,
	kind: GraphNodeKind,
	path: string,
	space: string,
	colorKey: string,
): GraphNode {
	return {
		id,
		label,
		kind,
		path,
		space,
		colorKey,
		inDegree: 0,
		outDegree: 0,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		pinned: false,
	};
}

/** Notes the graph should contain, honouring the query and local graph mode. */
function resolveScope(
	included: Map<string, NoteEntry>,
	options: GraphOptions,
): NoteEntry[] {
	let scope = Array.from(included.values());

	if (options.focusPath !== null) {
		const focus = included.get(options.focusPath);
		scope = focus ? neighbourhood(included, focus, options.depth) : [];
	}

	if (Object.keys(options.facets).length > 0) {
		scope = scope.filter((note) => matchesFilters(note.facets, options.facets));
	}

	const query = options.query.trim().toLowerCase();
	if (query !== '') {
		scope = scope.filter(
			(note) =>
				note.path.toLowerCase().includes(query) ||
				note.title.toLowerCase().includes(query) ||
				note.tags.some((tag) => tag.toLowerCase().includes(query)),
		);
	}
	return scope;
}

/** Breadth first walk over links in both directions. */
function neighbourhood(
	included: Map<string, NoteEntry>,
	focus: NoteEntry,
	depth: number,
): NoteEntry[] {
	const seen = new Map<string, NoteEntry>([[focus.path, focus]]);
	let frontier: NoteEntry[] = [focus];
	for (let step = 0; step < Math.max(0, depth); step++) {
		const next: NoteEntry[] = [];
		for (const note of frontier) {
			const neighbours: string[] = [...note.incoming];
			for (const link of note.outgoing) {
				if (link.resolved) {
					neighbours.push(link.target);
				}
			}
			for (const path of neighbours) {
				if (seen.has(path)) {
					continue;
				}
				const neighbour = included.get(path);
				if (neighbour) {
					seen.set(path, neighbour);
					next.push(neighbour);
				}
			}
		}
		frontier = next;
	}
	return Array.from(seen.values());
}

function markMutualEdges(edges: GraphEdge[]): void {
	const pairs = new Set(edges.map((edge) => `${edge.source} ${edge.target}`));
	for (const edge of edges) {
		if (pairs.has(`${edge.target} ${edge.source}`)) {
			edge.mutual = true;
		}
	}
}
