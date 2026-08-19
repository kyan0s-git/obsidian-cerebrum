import type { GraphData, GraphEdge, GraphNode } from '../core/link-graph';
import { colorFor } from '../utils/palette';

export interface Camera {
	x: number;
	y: number;
	scale: number;
}

export interface ThemeColors {
	background: string;
	text: string;
	muted: string;
	faint: string;
	accent: string;
	font: string;
}

export interface DrawOptions {
	showArrows: boolean;
	showLabels: boolean;
	hovered: GraphNode | null;
	focusPath: string | null;
	/** Ids connected to the hovered or focused node, everything else dims. */
	highlighted: Set<string> | null;
	theme: ThemeColors;
}

/** Reads the current theme's colours so the graph matches light and dark mode. */
export function readTheme(el: HTMLElement): ThemeColors {
	const style = window.getComputedStyle(el);
	const read = (name: string, fallback: string): string => {
		const value = style.getPropertyValue(name).trim();
		return value === '' ? fallback : value;
	};
	return {
		background: read('--background-primary', '#1e1e1e'),
		text: read('--text-normal', '#dcddde'),
		muted: read('--text-muted', '#999999'),
		faint: read('--background-modifier-border', '#3f3f3f'),
		accent: read('--interactive-accent', '#7f6df2'),
		font: read(
			'--font-interface',
			'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		),
	};
}

export function nodeRadius(node: GraphNode): number {
	const degree = node.inDegree + node.outDegree;
	const base = node.kind === 'ghost' ? 3 : 4;
	return base + Math.sqrt(degree) * 1.6;
}

export function nodeColor(node: GraphNode, theme: ThemeColors): string {
	if (node.kind === 'ghost') {
		return theme.muted;
	}
	if (node.kind === 'attachment') {
		return colorFor(`attachment:${node.path.split('.').pop() ?? ''}`);
	}
	return colorFor(node.colorKey);
}

/** Screen position of a world coordinate. */
export function toScreen(
	camera: Camera,
	width: number,
	height: number,
	x: number,
	y: number,
): { x: number; y: number } {
	return {
		x: (x - camera.x) * camera.scale + width / 2,
		y: (y - camera.y) * camera.scale + height / 2,
	};
}

/** World position of a screen coordinate. */
export function toWorld(
	camera: Camera,
	width: number,
	height: number,
	x: number,
	y: number,
): { x: number; y: number } {
	return {
		x: (x - width / 2) / camera.scale + camera.x,
		y: (y - height / 2) / camera.scale + camera.y,
	};
}

export function drawGraph(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	data: GraphData,
	camera: Camera,
	options: DrawOptions,
): void {
	const { theme } = options;
	context.save();
	context.clearRect(0, 0, width, height);
	context.fillStyle = theme.background;
	context.fillRect(0, 0, width, height);

	context.translate(width / 2, height / 2);
	context.scale(camera.scale, camera.scale);
	context.translate(-camera.x, -camera.y);

	const positions = new Map<string, GraphNode>();
	for (const node of data.nodes) {
		positions.set(node.id, node);
	}

	drawEdges(context, data.edges, positions, camera, options);
	drawNodes(context, data.nodes, camera, options);
	context.restore();
}

function isDimmed(id: string, options: DrawOptions): boolean {
	return options.highlighted !== null && !options.highlighted.has(id);
}

function drawEdges(
	context: CanvasRenderingContext2D,
	edges: GraphEdge[],
	positions: Map<string, GraphNode>,
	camera: Camera,
	options: DrawOptions,
): void {
	context.lineCap = 'round';
	for (const edge of edges) {
		const source = positions.get(edge.source);
		const target = positions.get(edge.target);
		if (!source || !target) {
			continue;
		}
		const dimmed =
			isDimmed(edge.source, options) || isDimmed(edge.target, options);
		const active =
			options.highlighted !== null &&
			options.highlighted.has(edge.source) &&
			options.highlighted.has(edge.target);

		context.save();
		context.globalAlpha = dimmed ? 0.06 : active ? 0.95 : 0.42;
		context.strokeStyle = active
			? options.theme.accent
			: edge.resolved
				? options.theme.faint
				: options.theme.muted;
		context.lineWidth = (active ? 1.8 : 1.1) / camera.scale;
		if (edge.kind === 'embed') {
			context.setLineDash([6 / camera.scale, 4 / camera.scale]);
		} else if (edge.kind === 'frontmatter') {
			context.setLineDash([2 / camera.scale, 3 / camera.scale]);
		}

		const radius = nodeRadius(target);
		const dx = target.x - source.x;
		const dy = target.y - source.y;
		const length = Math.sqrt(dx * dx + dy * dy) || 1;
		const endX = target.x - (dx / length) * radius;
		const endY = target.y - (dy / length) * radius;

		context.beginPath();
		context.moveTo(source.x, source.y);
		context.lineTo(endX, endY);
		context.stroke();

		if (options.showArrows && camera.scale > 0.45 && !dimmed) {
			drawArrowHead(context, dx / length, dy / length, endX, endY, camera);
		}
		context.restore();
	}
}

function drawArrowHead(
	context: CanvasRenderingContext2D,
	dirX: number,
	dirY: number,
	x: number,
	y: number,
	camera: Camera,
): void {
	const size = 6 / camera.scale;
	const angle = Math.atan2(dirY, dirX);
	context.beginPath();
	context.moveTo(x, y);
	context.lineTo(
		x - size * Math.cos(angle - Math.PI / 7),
		y - size * Math.sin(angle - Math.PI / 7),
	);
	context.lineTo(
		x - size * Math.cos(angle + Math.PI / 7),
		y - size * Math.sin(angle + Math.PI / 7),
	);
	context.closePath();
	context.fillStyle = context.strokeStyle;
	context.fill();
}

function drawNodes(
	context: CanvasRenderingContext2D,
	nodes: GraphNode[],
	camera: Camera,
	options: DrawOptions,
): void {
	const labelScale = camera.scale > 0.75;
	for (const node of nodes) {
		const dimmed = isDimmed(node.id, options);
		const radius = nodeRadius(node);
		const isFocus = node.path !== '' && node.path === options.focusPath;
		const isHovered = options.hovered?.id === node.id;

		context.save();
		context.globalAlpha = dimmed ? 0.12 : 1;
		context.beginPath();
		context.arc(node.x, node.y, radius, 0, Math.PI * 2);
		if (node.kind === 'ghost') {
			context.strokeStyle = nodeColor(node, options.theme);
			context.lineWidth = 1.4 / camera.scale;
			context.stroke();
		} else {
			context.fillStyle = nodeColor(node, options.theme);
			context.fill();
		}
		if (isFocus || isHovered) {
			context.beginPath();
			context.arc(node.x, node.y, radius + 3 / camera.scale, 0, Math.PI * 2);
			context.strokeStyle = options.theme.accent;
			context.lineWidth = 2 / camera.scale;
			context.stroke();
		}

		const showLabel =
			options.showLabels && !dimmed && (labelScale || isHovered || isFocus);
		if (showLabel) {
			context.globalAlpha = dimmed ? 0.1 : isHovered || isFocus ? 1 : 0.8;
			context.fillStyle =
				isHovered || isFocus ? options.theme.text : options.theme.muted;
			context.font = `${12 / camera.scale}px ${options.theme.font}`;
			context.textAlign = 'center';
			context.textBaseline = 'top';
			context.fillText(
				truncate(node.label, 28),
				node.x,
				node.y + radius + 3 / camera.scale,
			);
		}
		context.restore();
	}
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Nearest node under a world position, or null. */
export function hitTest(
	data: GraphData,
	x: number,
	y: number,
	scale: number,
): GraphNode | null {
	let best: GraphNode | null = null;
	let bestDistance = Infinity;
	for (const node of data.nodes) {
		const radius = nodeRadius(node) + 6 / scale;
		const dx = node.x - x;
		const dy = node.y - y;
		const distance = dx * dx + dy * dy;
		if (distance <= radius * radius && distance < bestDistance) {
			best = node;
			bestDistance = distance;
		}
	}
	return best;
}

/** Camera that fits every node with a little padding. */
export function fitCamera(
	data: GraphData,
	width: number,
	height: number,
): Camera {
	if (data.nodes.length === 0) {
		return { x: 0, y: 0, scale: 1 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const node of data.nodes) {
		minX = Math.min(minX, node.x);
		minY = Math.min(minY, node.y);
		maxX = Math.max(maxX, node.x);
		maxY = Math.max(maxY, node.y);
	}
	const spanX = Math.max(maxX - minX, 1);
	const spanY = Math.max(maxY - minY, 1);
	const scale = Math.min(
		Math.min(width / (spanX * 1.25), height / (spanY * 1.25)),
		2.5,
	);
	return {
		x: (minX + maxX) / 2,
		y: (minY + maxY) / 2,
		scale: Math.max(scale, 0.05),
	};
}
