import type { GraphEdge, GraphNode } from '../core/link-graph';

export interface SimulationOptions {
	linkDistance: number;
	repelStrength: number;
	centerStrength: number;
}

const DAMPING = 0.78;
const ALPHA_DECAY = 0.988;
const ALPHA_MIN = 0.004;
const SPRING_STIFFNESS = 0.06;
const MAX_VELOCITY = 60;
const THETA = 0.9;
const MAX_DEPTH = 22;

interface Cell {
	x: number;
	y: number;
	size: number;
	mass: number;
	cx: number;
	cy: number;
	body: GraphNode | null;
	children: (Cell | null)[] | null;
}

/**
 * A small force directed layout: links pull, nodes push apart, and the whole
 * thing drifts towards the middle. Repulsion goes through a Barnes-Hut
 * quadtree so a few thousand pages still settle quickly.
 */
export class ForceSimulation {
	alpha = 1;

	private readonly byId = new Map<string, GraphNode>();

	constructor(
		private nodes: GraphNode[],
		private edges: GraphEdge[],
		private options: SimulationOptions,
	) {
		this.index();
		this.seedPositions();
	}

	get settled(): boolean {
		return this.alpha < ALPHA_MIN;
	}

	setOptions(options: SimulationOptions): void {
		this.options = options;
		this.reheat(0.6);
	}

	reheat(alpha = 1): void {
		this.alpha = Math.max(this.alpha, alpha);
	}

	/** Advances the layout by one frame. */
	tick(): void {
		if (this.settled) {
			return;
		}
		const alpha = this.alpha;
		this.applyRepulsion(alpha);
		this.applySprings(alpha);
		this.applyCentering(alpha);
		this.integrate();
		this.alpha *= ALPHA_DECAY;
	}

	private index(): void {
		this.byId.clear();
		for (const node of this.nodes) {
			this.byId.set(node.id, node);
		}
	}

	/** Phyllotaxis spread, which avoids the symmetric explosion of a grid. */
	private seedPositions(): void {
		const spacing = Math.max(this.options.linkDistance, 40) * 0.8;
		let index = 0;
		for (const node of this.nodes) {
			if (node.x !== 0 || node.y !== 0) {
				index++;
				continue;
			}
			const radius = spacing * Math.sqrt(index + 0.5) * 0.5;
			const angle = index * 2.399963229728653;
			node.x = radius * Math.cos(angle);
			node.y = radius * Math.sin(angle);
			index++;
		}
	}

	private applySprings(alpha: number): void {
		const distance = this.options.linkDistance;
		for (const edge of this.edges) {
			const source = this.byId.get(edge.source);
			const target = this.byId.get(edge.target);
			if (!source || !target) {
				continue;
			}
			let dx = target.x - source.x;
			let dy = target.y - source.y;
			let length = Math.sqrt(dx * dx + dy * dy);
			if (length < 0.01) {
				dx = Math.random() - 0.5;
				dy = Math.random() - 0.5;
				length = 1;
			}
			const strength =
				((length - distance) / length) * SPRING_STIFFNESS * alpha;
			const fx = dx * strength;
			const fy = dy * strength;
			source.vx += fx;
			source.vy += fy;
			target.vx -= fx;
			target.vy -= fy;
		}
	}

	private applyCentering(alpha: number): void {
		const strength = this.options.centerStrength * alpha;
		if (strength <= 0) {
			return;
		}
		for (const node of this.nodes) {
			node.vx -= node.x * strength;
			node.vy -= node.y * strength;
		}
	}

	private applyRepulsion(alpha: number): void {
		const root = this.buildTree();
		if (!root) {
			return;
		}
		const strength = this.options.repelStrength * alpha;
		for (const node of this.nodes) {
			this.repelFrom(root, node, strength);
		}
	}

	private integrate(): void {
		for (const node of this.nodes) {
			if (node.pinned) {
				node.vx = 0;
				node.vy = 0;
				continue;
			}
			node.vx = clamp(node.vx * DAMPING, MAX_VELOCITY);
			node.vy = clamp(node.vy * DAMPING, MAX_VELOCITY);
			node.x += node.vx;
			node.y += node.vy;
		}
	}

	private buildTree(): Cell | null {
		if (this.nodes.length === 0) {
			return null;
		}
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const node of this.nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x);
			maxY = Math.max(maxY, node.y);
		}
		const size = Math.max(maxX - minX, maxY - minY, 1) * 1.05;
		const root = makeCell(minX, minY, size);
		for (const node of this.nodes) {
			insert(root, node, 0);
		}
		return root;
	}

	private repelFrom(cell: Cell, node: GraphNode, strength: number): void {
		if (cell.mass === 0 || cell.body === node) {
			return;
		}
		let dx = node.x - cell.cx;
		let dy = node.y - cell.cy;
		let distanceSq = dx * dx + dy * dy;
		if (distanceSq < 1) {
			dx = (Math.random() - 0.5) * 2;
			dy = (Math.random() - 0.5) * 2;
			distanceSq = dx * dx + dy * dy + 0.5;
		}
		const isLeaf = cell.children === null;
		if (isLeaf || (cell.size * cell.size) / distanceSq < THETA * THETA) {
			const force = (strength * cell.mass) / distanceSq;
			const distance = Math.sqrt(distanceSq);
			node.vx += (dx / distance) * force;
			node.vy += (dy / distance) * force;
			return;
		}
		for (const child of cell.children ?? []) {
			if (child) {
				this.repelFrom(child, node, strength);
			}
		}
	}
}

function makeCell(x: number, y: number, size: number): Cell {
	return {
		x,
		y,
		size,
		mass: 0,
		cx: 0,
		cy: 0,
		body: null,
		children: null,
	};
}

function insert(cell: Cell, node: GraphNode, depth: number): void {
	// Running centre of mass for this cell.
	const totalMass = cell.mass + 1;
	cell.cx = (cell.cx * cell.mass + node.x) / totalMass;
	cell.cy = (cell.cy * cell.mass + node.y) / totalMass;
	cell.mass = totalMass;

	if (cell.mass === 1) {
		cell.body = node;
		return;
	}

	if (cell.children === null) {
		cell.children = [null, null, null, null];
		const existing = cell.body;
		cell.body = null;
		if (existing && depth < MAX_DEPTH) {
			insertIntoChild(cell, existing, depth);
		}
	}
	if (depth < MAX_DEPTH) {
		insertIntoChild(cell, node, depth);
	}
}

function insertIntoChild(cell: Cell, node: GraphNode, depth: number): void {
	const half = cell.size / 2;
	const east = node.x >= cell.x + half ? 1 : 0;
	const south = node.y >= cell.y + half ? 1 : 0;
	const index = south * 2 + east;
	const children = cell.children;
	if (!children) {
		return;
	}
	let child = children[index];
	if (!child) {
		child = makeCell(cell.x + east * half, cell.y + south * half, half);
		children[index] = child;
	}
	insert(child, node, depth + 1);
}

function clamp(value: number, limit: number): number {
	if (value > limit) {
		return limit;
	}
	if (value < -limit) {
		return -limit;
	}
	return value;
}
