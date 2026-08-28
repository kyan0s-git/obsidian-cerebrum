import { ItemView, ViewStateResult, WorkspaceLeaf, debounce } from 'obsidian';
import { EXPLORER_ICON, EXPLORER_VIEW_TYPE, PAGE_SIZE } from '../constants';
import type { ExcerptStore } from '../core/excerpts';
import { descend } from '../core/navigation';
import type { TrailStep } from '../core/navigation';
import type { VaultModel } from '../core/vault-model';
import type { CerebrumSettings } from '../settings';
import { renderBody } from './explorer-body';
import { renderHeader } from './explorer-header';
import { openGraph } from './view-actions';

/** Which of the browser's few screens is showing. */
export type ExplorerScreen = 'browse' | 'tags' | 'tag' | 'all' | 'loose';

export interface ExplorerState {
	screen: ExplorerScreen;
	/** The walk down the hierarchy, innermost last. Empty is home. */
	trail: TrailStep[];
	/** The tag being read, when the screen is a tag. */
	tag: string;
	query: string;
	/** How many notes of the current list are rendered. */
	visible: number;
}

/** Everything the browser's render functions are allowed to touch. */
export interface ExplorerContext {
	view: ExplorerView;
	model: VaultModel;
	excerpts: ExcerptStore;
	settings: CerebrumSettings;
	state: ExplorerState;
	/** Moves to another screen, recording it so Back works. */
	go(state: Partial<ExplorerState>): void;
	/** Walks down the hierarchy, straight through anything with one way on. */
	open(steps: TrailStep[]): void;
	setQuery(query: string): void;
	showMore(): void;
	persist(): void;
}

export interface ExplorerDeps {
	model: VaultModel;
	excerpts: ExcerptStore;
	settings: CerebrumSettings;
	saveSettings: () => Promise<void>;
}

function emptyState(): ExplorerState {
	return { screen: 'browse', trail: [], tag: '', query: '', visible: PAGE_SIZE };
}

/**
 * The browser.
 *
 * One decision per screen: home offers the first level, each step offers the
 * next, and the last offers the notes themselves. A breadcrumb sits above
 * everything, and every move is recorded so the tab's own back arrow walks it
 * in reverse.
 */
export class ExplorerView extends ItemView {
	navigation = true;

	private readonly deps: ExplorerDeps;
	private state: ExplorerState = emptyState();
	private headerEl!: HTMLElement;
	private bodyEl!: HTMLElement;
	private unsubscribe: (() => void) | null = null;
	/** Set while applying a state Obsidian handed us, to not re-record it. */
	private restoring = false;

	private readonly render = debounce(() => this.renderAll(), 40, true);
	private readonly renderResults = debounce(() => this.renderBodyOnly(), 120, true);

	constructor(leaf: WorkspaceLeaf, deps: ExplorerDeps) {
		super(leaf);
		this.deps = deps;
		this.icon = EXPLORER_ICON;
	}

	getViewType(): string {
		return EXPLORER_VIEW_TYPE;
	}

	getDisplayText(): string {
		const last = this.state.trail[this.state.trail.length - 1];
		if (this.state.screen === 'tag' && this.state.tag !== '') {
			return this.state.tag;
		}
		return last ? last.value : 'Cerebrum';
	}

	getState(): Record<string, unknown> {
		return {
			screen: this.state.screen,
			trail: this.state.trail.map((step) => ({ ...step })),
			tag: this.state.tag,
			query: this.state.query,
		};
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const record =
			state !== null && typeof state === 'object'
				? (state as Record<string, unknown>)
				: {};

		const next = emptyState();
		if (typeof record.screen === 'string' && isScreen(record.screen)) {
			next.screen = record.screen;
		}
		if (Array.isArray(record.trail)) {
			for (const raw of record.trail) {
				if (raw === null || typeof raw !== 'object') {
					continue;
				}
				const step = raw as Record<string, unknown>;
				if (typeof step.name === 'string' && typeof step.value === 'string') {
					next.trail.push({ name: step.name, value: step.value });
				}
			}
		}
		if (typeof record.tag === 'string') {
			next.tag = record.tag;
		}
		if (typeof record.query === 'string') {
			next.query = record.query;
		}

		this.state = next;
		this.render();
		await super.setState(state, result);
	}

	protected async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass('cerebrum-explorer');

		const page = container.createDiv({ cls: 'cerebrum-page' });
		this.headerEl = page.createDiv({ cls: 'cerebrum-header' });
		this.bodyEl = page.createDiv({ cls: 'cerebrum-body' });

		this.addAction('git-fork', 'Show this view in the graph', () => {
			const last = this.state.trail[this.state.trail.length - 1];
			void openGraph(this.app, {
				query: last ? last.value : this.state.query,
				focusPath: null,
			});
		});

		this.unsubscribe = this.deps.model.subscribe(() => this.render());
		this.deps.model.ensureBuilt();
		this.renderAll();
	}

	protected async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.contentEl.empty();
	}

	/** Points the browser at a place, from a command or another view. */
	reveal(state: Partial<ExplorerState>): void {
		this.navigate(state);
	}

	/**
	 * Every move goes through the workspace rather than straight to the field,
	 * so Obsidian records it and the tab's back arrow walks the trail in
	 * reverse — the same way its own file history works.
	 */
	private navigate(partial: Partial<ExplorerState>): void {
		const next: ExplorerState = {
			...this.state,
			visible: PAGE_SIZE,
			...partial,
		};
		this.state = next;
		if (this.restoring) {
			this.renderAll();
			return;
		}
		this.restoring = true;
		void this.leaf
			.setViewState(
				{
					type: EXPLORER_VIEW_TYPE,
					active: true,
					state: {
						screen: next.screen,
						trail: next.trail,
						tag: next.tag,
						query: next.query,
					},
				},
				{ history: true },
			)
			.finally(() => {
				this.restoring = false;
			});
	}

	private context(): ExplorerContext {
		return {
			view: this,
			model: this.deps.model,
			excerpts: this.deps.excerpts,
			settings: this.deps.settings,
			state: this.state,
			go: (partial) => {
				this.navigate(partial);
			},
			open: (steps) => {
				this.navigate({
					screen: 'browse',
					trail: descend(this.deps.model, this.deps.settings, [
						...this.state.trail,
						...steps,
					]),
					query: '',
				});
			},
			setQuery: (query) => {
				this.state.query = query;
				this.state.visible = PAGE_SIZE;
				this.renderResults();
			},
			showMore: () => {
				this.state.visible += PAGE_SIZE;
				this.renderResults();
			},
			persist: () => {
				void this.deps.saveSettings();
				this.render();
			},
		};
	}

	private renderAll(): void {
		if (!this.headerEl) {
			return;
		}
		renderHeader(this.headerEl, this.context());
		this.renderBodyOnly();
	}

	private renderBodyOnly(): void {
		if (!this.bodyEl) {
			return;
		}
		renderBody(this.bodyEl, this.context());
	}
}

function isScreen(value: string): value is ExplorerScreen {
	return ['browse', 'tags', 'tag', 'all', 'loose'].includes(value);
}
