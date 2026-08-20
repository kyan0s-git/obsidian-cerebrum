import {
	ItemView,
	Menu,
	TFile,
	ViewStateResult,
	WorkspaceLeaf,
	debounce,
	setIcon,
	setTooltip,
} from 'obsidian';
import { GRAPH_ICON, GRAPH_VIEW_TYPE } from '../constants';
import { GraphData, GraphNode, buildGraph } from '../core/link-graph';
import type { VaultModel } from '../core/vault-model';
import type { CerebrumSettings } from '../settings';
import { colorFor } from '../utils/palette';
import { openFile, openLink, showFileMenu } from './file-actions';
import {
	Camera,
	ThemeColors,
	drawGraph,
	fitCamera,
	hitTest,
	readTheme,
	toWorld,
} from './graph-renderer';
import { ForceSimulation } from './graph-simulation';

export interface GraphDeps {
	model: VaultModel;
	settings: CerebrumSettings;
	saveSettings: () => Promise<void>;
}

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [], truncated: 0 };

/**
 * A graph of what every page actually links to. Edges come from each note's own
 * references, so links, embeds and frontmatter links all show up with the
 * direction they were written in, and links to pages that do not exist yet
 * appear as hollow nodes.
 */
export class GraphView extends ItemView {
	navigation = true;

	private readonly deps: GraphDeps;
	private canvas!: HTMLCanvasElement;
	private context: CanvasRenderingContext2D | null = null;
	private statusEl!: HTMLElement;
	private legendEl!: HTMLElement;
	private toolbarEl!: HTMLElement;

	private data: GraphData = EMPTY_GRAPH;
	private simulation: ForceSimulation | null = null;
	private camera: Camera = { x: 0, y: 0, scale: 1 };
	private theme: ThemeColors | null = null;

	private query = '';
	private facetFilters: Record<string, string> = {};
	private focusPath: string | null = null;
	private followActive = false;
	private hovered: GraphNode | null = null;
	private dragging: GraphNode | null = null;
	private panning = false;
	private pointerMoved = false;
	private lastPointer = { x: 0, y: 0 };

	private frame: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private unsubscribe: (() => void) | null = null;

	private readonly scheduleRebuild = debounce(() => this.rebuild(), 250, true);

	constructor(leaf: WorkspaceLeaf, deps: GraphDeps) {
		super(leaf);
		this.deps = deps;
		this.icon = GRAPH_ICON;
	}

	getViewType(): string {
		return GRAPH_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.focusPath === null ? 'Link graph' : 'Local link graph';
	}

	getState(): Record<string, unknown> {
		return {
			query: this.query,
			facets: { ...this.facetFilters },
			focusPath: this.focusPath,
			followActive: this.followActive,
		};
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const record =
			state !== null && typeof state === 'object'
				? (state as Record<string, unknown>)
				: {};
		if (typeof record.query === 'string') {
			this.query = record.query;
		}
		if (typeof record.focusPath === 'string') {
			this.focusPath = record.focusPath;
		} else if (record.focusPath === null) {
			this.focusPath = null;
		}
		if (typeof record.followActive === 'boolean') {
			this.followActive = record.followActive;
		}
		if (record.facets !== null && typeof record.facets === 'object') {
			this.facetFilters = {};
			for (const [name, value] of Object.entries(
				record.facets as Record<string, unknown>,
			)) {
				if (typeof value === 'string') {
					this.facetFilters[name] = value;
				}
			}
		}
		this.rebuild(true);
		await super.setState(state, result);
	}

	protected async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass('cerebrum-graph');

		this.toolbarEl = container.createDiv({ cls: 'cerebrum-graph-toolbar' });
		const stage = container.createDiv({ cls: 'cerebrum-graph-stage' });
		this.canvas = stage.createEl('canvas', { cls: 'cerebrum-graph-canvas' });
		this.legendEl = stage.createDiv({ cls: 'cerebrum-graph-legend' });
		this.statusEl = container.createDiv({ cls: 'cerebrum-graph-status' });
		this.context = this.canvas.getContext('2d');

		this.wirePointer();
		this.resizeObserver = new ResizeObserver(() => {
			this.resizeCanvas();
		});
		this.resizeObserver.observe(stage);

		this.unsubscribe = this.deps.model.subscribe(() => this.scheduleRebuild());
		this.deps.model.ensureBuilt();
		this.renderToolbar();
		this.resizeCanvas();
		this.rebuild(true);
		this.startLoop();
	}

	protected async onClose(): Promise<void> {
		this.stopLoop();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.contentEl.empty();
	}

	/** Called by the plugin when the theme changes. */
	refreshTheme(): void {
		this.theme = null;
	}

	/** Called by the plugin when the active note changes. */
	onActiveFileChanged(file: TFile | null): void {
		if (!this.followActive) {
			return;
		}
		this.focusPath = file ? file.path : null;
		this.rebuild(true);
	}

	/** Points the graph at one note and switches to local mode. */
	focusOn(path: string | null): void {
		this.focusPath = path;
		this.followActive = path !== null && this.followActive;
		this.renderToolbar();
		this.rebuild(true);
	}

	private options() {
		const settings = this.deps.settings;
		return {
			includeAttachments: settings.graphIncludeAttachments,
			includeUnresolved: settings.graphIncludeUnresolved,
			includeOrphans: settings.graphIncludeOrphans,
			maxNodes: settings.graphMaxNodes,
			focusPath: this.focusPath,
			depth: settings.graphLocalDepth,
			query: this.query,
			colorBy: settings.graphColorBy,
			facets: this.facetFilters,
		};
	}

	private rebuild(refit = false): void {
		if (!this.canvas) {
			return;
		}
		this.deps.model.ensureBuilt();
		const previous = new Map(this.data.nodes.map((node) => [node.id, node]));
		this.data = buildGraph(this.deps.model, this.options());

		// Carry positions over so a rebuild does not throw the layout away.
		for (const node of this.data.nodes) {
			const old = previous.get(node.id);
			if (old) {
				node.x = old.x;
				node.y = old.y;
				node.pinned = old.pinned;
			}
		}

		this.simulation = new ForceSimulation(this.data.nodes, this.data.edges, {
			linkDistance: this.deps.settings.graphLinkDistance,
			repelStrength: this.deps.settings.graphRepelStrength,
			centerStrength: this.deps.settings.graphCenterStrength,
		});
		this.simulation.reheat(refit ? 1 : 0.5);
		if (refit) {
			window.setTimeout(() => {
				this.fit();
			}, 60);
		}
		this.renderStatus();
		this.renderLegend();
		this.startLoop();
	}

	private fit(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) {
			return;
		}
		this.camera = fitCamera(this.data, rect.width, rect.height);
	}

	private resizeCanvas(): void {
		const rect = this.canvas.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
		this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
		this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
		this.startLoop();
	}

	private startLoop(): void {
		if (this.frame !== null) {
			return;
		}
		const step = (): void => {
			this.frame = null;
			this.simulation?.tick();
			this.paint();
			if (this.simulation && !this.simulation.settled) {
				this.frame = window.requestAnimationFrame(step);
			}
		};
		this.frame = window.requestAnimationFrame(step);
	}

	private stopLoop(): void {
		if (this.frame !== null) {
			window.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
	}

	private paint(): void {
		if (!this.context) {
			return;
		}
		this.theme ??= readTheme(this.containerEl);
		const rect = this.canvas.getBoundingClientRect();
		drawGraph(this.context, rect.width, rect.height, this.data, this.camera, {
			showArrows: this.deps.settings.graphShowArrows,
			showLabels: this.deps.settings.graphShowLabels,
			hovered: this.hovered,
			focusPath: this.focusPath,
			highlighted: this.highlightSet(),
			theme: this.theme,
		});
	}

	/** Ids to keep bright: the hovered node and everything it touches. */
	private highlightSet(): Set<string> | null {
		const anchor = this.hovered;
		if (!anchor) {
			return null;
		}
		const ids = new Set<string>([anchor.id]);
		for (const edge of this.data.edges) {
			if (edge.source === anchor.id) {
				ids.add(edge.target);
			} else if (edge.target === anchor.id) {
				ids.add(edge.source);
			}
		}
		return ids;
	}

	private pointerWorld(evt: PointerEvent | MouseEvent): {
		x: number;
		y: number;
	} {
		const rect = this.canvas.getBoundingClientRect();
		return toWorld(
			this.camera,
			rect.width,
			rect.height,
			evt.clientX - rect.left,
			evt.clientY - rect.top,
		);
	}

	private wirePointer(): void {
		const canvas = this.canvas;

		canvas.addEventListener('pointerdown', (evt: PointerEvent) => {
			const world = this.pointerWorld(evt);
			const node = hitTest(this.data, world.x, world.y, this.camera.scale);
			this.pointerMoved = false;
			this.lastPointer = { x: evt.clientX, y: evt.clientY };
			canvas.setPointerCapture(evt.pointerId);
			if (node && evt.button === 0) {
				this.dragging = node;
				node.pinned = true;
			} else if (evt.button === 0) {
				this.panning = true;
			}
		});

		canvas.addEventListener('pointermove', (evt: PointerEvent) => {
			const world = this.pointerWorld(evt);
			if (
				Math.abs(evt.clientX - this.lastPointer.x) > 3 ||
				Math.abs(evt.clientY - this.lastPointer.y) > 3
			) {
				this.pointerMoved = true;
			}
			if (this.dragging) {
				this.dragging.x = world.x;
				this.dragging.y = world.y;
				this.simulation?.reheat(0.35);
				this.startLoop();
				return;
			}
			if (this.panning) {
				const dx = (evt.clientX - this.lastPointer.x) / this.camera.scale;
				const dy = (evt.clientY - this.lastPointer.y) / this.camera.scale;
				this.camera.x -= dx;
				this.camera.y -= dy;
				this.lastPointer = { x: evt.clientX, y: evt.clientY };
				this.startLoop();
				this.paint();
				return;
			}
			const node = hitTest(this.data, world.x, world.y, this.camera.scale);
			if (node !== this.hovered) {
				this.hovered = node;
				canvas.toggleClass('is-hovering-node', node !== null);
				this.paint();
			}
		});

		const endPointer = (evt: PointerEvent): void => {
			if (canvas.hasPointerCapture(evt.pointerId)) {
				canvas.releasePointerCapture(evt.pointerId);
			}
			const dragged = this.dragging;
			if (dragged) {
				// A click without movement opens the note, a drag pins the node.
				if (!this.pointerMoved) {
					dragged.pinned = false;
					this.activate(dragged, evt);
				}
				this.dragging = null;
			}
			this.panning = false;
		};
		canvas.addEventListener('pointerup', endPointer);
		canvas.addEventListener('pointercancel', endPointer);

		canvas.addEventListener(
			'wheel',
			(evt: WheelEvent) => {
				evt.preventDefault();
				const rect = canvas.getBoundingClientRect();
				const before = toWorld(
					this.camera,
					rect.width,
					rect.height,
					evt.clientX - rect.left,
					evt.clientY - rect.top,
				);
				const factor = Math.exp(-evt.deltaY * 0.0015);
				this.camera.scale = Math.min(
					6,
					Math.max(0.05, this.camera.scale * factor),
				);
				const after = toWorld(
					this.camera,
					rect.width,
					rect.height,
					evt.clientX - rect.left,
					evt.clientY - rect.top,
				);
				this.camera.x += before.x - after.x;
				this.camera.y += before.y - after.y;
				this.paint();
			},
			{ passive: false },
		);

		canvas.addEventListener('contextmenu', (evt: MouseEvent) => {
			const world = this.pointerWorld(evt);
			const node = hitTest(this.data, world.x, world.y, this.camera.scale);
			if (!node || node.path === '') {
				return;
			}
			const file = this.app.vault.getFileByPath(node.path);
			if (!file) {
				return;
			}
			evt.preventDefault();
			showFileMenu(this.app, file, evt, GRAPH_VIEW_TYPE);
		});

		canvas.addEventListener('dblclick', (evt: MouseEvent) => {
			const world = this.pointerWorld(evt);
			const node = hitTest(this.data, world.x, world.y, this.camera.scale);
			if (node && node.path !== '') {
				this.focusOn(node.path);
			}
		});
	}

	private activate(node: GraphNode, evt: PointerEvent): void {
		if (node.kind === 'ghost') {
			const source = this.data.edges.find((edge) => edge.target === node.id);
			openLink(
				this.app,
				node.label,
				source?.source ?? '',
				this.deps.settings.openInNewTab,
				evt,
			);
			return;
		}
		const file = this.app.vault.getFileByPath(node.path);
		if (file) {
			openFile(this.app, file, this.deps.settings.openInNewTab, evt);
		}
	}

	private renderToolbar(): void {
		const toolbar = this.toolbarEl;
		toolbar.empty();

		const search = toolbar.createDiv({ cls: 'cerebrum-search' });
		setIcon(search.createSpan({ cls: 'cerebrum-search-icon' }), 'filter');
		const input = search.createEl('input', {
			type: 'search',
			cls: 'cerebrum-search-input',
			attr: { placeholder: 'Filter by path, title or tag' },
		});
		input.value = this.query;
		input.addEventListener('input', () => {
			this.query = input.value;
			this.scheduleRebuild();
		});

		const facetNames = this.deps.model.getFacetNames();
		if (facetNames.length > 0) {
			const colorGroup = toolbar.createDiv({ cls: 'cerebrum-depth' });
			colorGroup.createSpan({ text: 'Colour' });
			const select = colorGroup.createEl('select', { cls: 'dropdown' });
			select.createEl('option', { value: '', text: 'Folder' });
			for (const name of facetNames) {
				select.createEl('option', {
					value: name,
					text: name.charAt(0).toUpperCase() + name.slice(1),
				});
			}
			select.value = this.deps.settings.graphColorBy;
			select.addEventListener('change', () => {
				this.deps.settings.graphColorBy = select.value;
				void this.deps.saveSettings();
				this.renderLegend();
				this.rebuild();
			});
		}

		for (const [name, value] of Object.entries(this.facetFilters)) {
			const chip = toolbar.createDiv({ cls: 'cerebrum-facet-chip' });
			chip.setCssProps({ '--cerebrum-accent': colorFor(value) });
			chip.createSpan({ cls: 'cerebrum-facet-name', text: name });
			chip.createSpan({ cls: 'cerebrum-facet-value', text: value });
			setIcon(chip.createSpan({ cls: 'cerebrum-facet-remove' }), 'x');
			setTooltip(chip, `Remove the ${name} filter`);
			chip.addEventListener('click', () => {
				delete this.facetFilters[name];
				this.renderToolbar();
				this.rebuild(true);
			});
		}

		this.toggleButton(toolbar, 'focus', 'Follow the active note', this.followActive, () => {
			this.followActive = !this.followActive;
			if (this.followActive) {
				this.focusPath = this.app.workspace.getActiveFile()?.path ?? null;
			} else {
				this.focusPath = null;
			}
			this.renderToolbar();
			this.rebuild(true);
		});

		if (this.focusPath !== null) {
			const depth = toolbar.createDiv({ cls: 'cerebrum-depth' });
			depth.createSpan({ text: 'Depth' });
			const select = depth.createEl('select', { cls: 'dropdown' });
			for (const value of [1, 2, 3, 4]) {
				select.createEl('option', {
					value: String(value),
					text: String(value),
				});
			}
			select.value = String(this.deps.settings.graphLocalDepth);
			select.addEventListener('change', () => {
				this.deps.settings.graphLocalDepth = Number(select.value);
				void this.deps.saveSettings();
				this.rebuild(true);
			});
			const clear = toolbar.createEl('button', { cls: 'clickable-icon' });
			setIcon(clear, 'x');
			setTooltip(clear, 'Back to the whole vault');
			clear.addEventListener('click', () => {
				this.followActive = false;
				this.focusOn(null);
			});
		}

		// Five toggles in a row is five decisions on every glance. They change
		// rarely, so they live behind one control that says what it is.
		const settings = this.deps.settings;
		const display = toolbar.createEl('button', { cls: 'clickable-icon' });
		setIcon(display, 'sliders-horizontal');
		setTooltip(display, 'Display options');
		display.addEventListener('click', (evt) => {
			const menu = new Menu();
			const toggle = (
				title: string,
				value: boolean,
				apply: (next: boolean) => void,
				redrawOnly = false,
			): void => {
				menu.addItem((item) =>
					item
						.setTitle(title)
						.setChecked(value)
						.onClick(() => {
							apply(!value);
							void this.deps.saveSettings();
							if (redrawOnly) {
								this.paint();
							} else {
								this.rebuild();
							}
						}),
				);
			};
			toggle('Attachments', settings.graphIncludeAttachments, (next) => {
				settings.graphIncludeAttachments = next;
			});
			toggle('Pages not written yet', settings.graphIncludeUnresolved, (next) => {
				settings.graphIncludeUnresolved = next;
			});
			toggle('Notes with no links', settings.graphIncludeOrphans, (next) => {
				settings.graphIncludeOrphans = next;
			});
			menu.addSeparator();
			toggle(
				'Link direction',
				settings.graphShowArrows,
				(next) => {
					settings.graphShowArrows = next;
				},
				true,
			);
			toggle(
				'Labels',
				settings.graphShowLabels,
				(next) => {
					settings.graphShowLabels = next;
				},
				true,
			);
			menu.showAtMouseEvent(evt);
		});

		const fit = toolbar.createEl('button', { cls: 'clickable-icon' });
		setIcon(fit, 'maximize');
		setTooltip(fit, 'Fit to view');
		fit.addEventListener('click', () => {
			this.fit();
			this.paint();
		});

		const relayout = toolbar.createEl('button', { cls: 'clickable-icon' });
		setIcon(relayout, 'refresh-cw');
		setTooltip(relayout, 'Run the layout again');
		relayout.addEventListener('click', () => {
			for (const node of this.data.nodes) {
				node.pinned = false;
			}
			this.simulation?.reheat(1);
			this.startLoop();
		});
	}

	private toggleButton(
		toolbar: HTMLElement,
		icon: string,
		tooltip: string,
		active: boolean,
		onClick: () => void,
	): void {
		const button = toolbar.createEl('button', {
			cls: active ? 'clickable-icon is-active' : 'clickable-icon',
		});
		setIcon(button, icon);
		setTooltip(button, tooltip);
		button.addEventListener('click', onClick);
	}

	private renderStatus(): void {
		const parts = [
			`${this.data.nodes.length} pages`,
			`${this.data.edges.length} links`,
		];
		if (this.data.truncated > 0) {
			parts.push(`${this.data.truncated} hidden by the node limit`);
		}
		if (this.focusPath !== null) {
			parts.push(`around ${this.focusPath}`);
		}
		this.statusEl.setText(parts.join(' · '));
	}

	private renderLegend(): void {
		this.legendEl.empty();
		const colorBy = this.deps.settings.graphColorBy;
		const counts = new Map<string, number>();
		for (const node of this.data.nodes) {
			if (node.kind !== 'note') {
				continue;
			}
			counts.set(node.colorKey, (counts.get(node.colorKey) ?? 0) + 1);
		}
		const groups = Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		const emptyLabel = colorBy === '' ? 'Vault root' : `No ${colorBy}`;
		for (const [key, count] of groups) {
			const item = this.legendEl.createDiv({ cls: 'cerebrum-legend-item' });
			item.setCssProps({ '--cerebrum-accent': colorFor(key) });
			item.createSpan({ cls: 'cerebrum-legend-dot' });
			item.createSpan({
				cls: 'cerebrum-legend-label',
				text: key === '' ? emptyLabel : key,
			});
			item.createSpan({ cls: 'cerebrum-legend-count', text: String(count) });
			item.addEventListener('click', () => {
				if (colorBy === '') {
					this.query = this.query === key ? '' : key;
				} else if (this.facetFilters[colorBy] === key) {
					delete this.facetFilters[colorBy];
				} else if (key !== '') {
					this.facetFilters[colorBy] = key;
				}
				this.renderToolbar();
				this.rebuild(true);
			});
		}
	}
}
