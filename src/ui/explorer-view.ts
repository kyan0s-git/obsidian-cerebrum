import { ItemView, ViewStateResult, WorkspaceLeaf, debounce } from 'obsidian';
import { EXPLORER_ICON, EXPLORER_VIEW_TYPE, PAGE_SIZE } from '../constants';
import type { ExcerptStore } from '../core/excerpts';
import type { VaultModel } from '../core/vault-model';
import type { CerebrumSettings } from '../settings';
import type { Selection, SmartListId } from '../types';
import { renderContent } from './explorer-content';
import { renderHeader } from './explorer-header';
import { renderRail } from './explorer-rail';

export interface ExplorerState {
	selection: Selection;
	/** Active facet filters, keyed by facet name. */
	facets: Record<string, string>;
	query: string;
	/** How many notes of the current result set are rendered. */
	visible: number;
}

/** Everything the explorer's render functions are allowed to touch. */
export interface ExplorerContext {
	view: ExplorerView;
	model: VaultModel;
	excerpts: ExcerptStore;
	settings: CerebrumSettings;
	state: ExplorerState;
	setSelection(selection: Selection): void;
	/** Sets a facet filter, or clears it when the value is null. */
	setFacet(name: string, value: string | null): void;
	clearFacets(): void;
	/** Opens or closes a rail section, remembering the choice. */
	toggleSection(title: string): void;
	setQuery(query: string): void;
	showMore(): void;
	refresh(): void;
	persist(): void;
}

export interface ExplorerDeps {
	model: VaultModel;
	excerpts: ExcerptStore;
	settings: CerebrumSettings;
	saveSettings: () => Promise<void>;
}

/**
 * The content browser. It replaces tree digging with a dashboard: collections
 * on the left, cards in the middle, and a breadcrumb for drilling into folders
 * the vault happens to have right now.
 */
export class ExplorerView extends ItemView {
	navigation = true;

	private readonly deps: ExplorerDeps;
	private state: ExplorerState = {
		selection: { kind: 'smart', value: 'all' },
		facets: {},
		query: '',
		visible: PAGE_SIZE,
	};
	private headerEl!: HTMLElement;
	private railEl!: HTMLElement;
	private contentAreaEl!: HTMLElement;
	private unsubscribe: (() => void) | null = null;

	private readonly render = debounce(() => this.renderAll(), 40, true);
	private readonly renderResults = debounce(() => this.renderBody(), 120, true);

	constructor(leaf: WorkspaceLeaf, deps: ExplorerDeps) {
		super(leaf);
		this.deps = deps;
		this.icon = EXPLORER_ICON;
	}

	getViewType(): string {
		return EXPLORER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Cerebrum';
	}

	getState(): Record<string, unknown> {
		return {
			selectionKind: this.state.selection.kind,
			selectionValue: this.state.selection.value,
			facets: { ...this.state.facets },
			query: this.state.query,
		};
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const record =
			state !== null && typeof state === 'object'
				? (state as Record<string, unknown>)
				: {};
		const kind = record.selectionKind;
		const value = record.selectionValue;
		if (typeof kind === 'string' && typeof value === 'string') {
			this.state.selection = restoreSelection(kind, value);
			this.state.visible = PAGE_SIZE;
		}
		if (typeof record.query === 'string') {
			this.state.query = record.query;
		}
		if (record.facets !== null && typeof record.facets === 'object') {
			this.state.facets = {};
			for (const [name, value] of Object.entries(
				record.facets as Record<string, unknown>,
			)) {
				if (typeof value === 'string') {
					this.state.facets[name] = value;
				}
			}
		}
		this.render();
		await super.setState(state, result);
	}

	protected async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();
		container.addClass('cerebrum-explorer');

		this.headerEl = container.createDiv({ cls: 'cerebrum-header' });
		const body = container.createDiv({ cls: 'cerebrum-body' });
		this.railEl = body.createDiv({ cls: 'cerebrum-rail' });
		this.contentAreaEl = body.createDiv({ cls: 'cerebrum-content' });

		this.unsubscribe = this.deps.model.subscribe(() => this.render());
		this.deps.model.ensureBuilt();
		this.renderAll();
	}

	protected async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.contentEl.empty();
	}

	/** Points the explorer at a folder, collection or tag. */
	reveal(selection: Selection): void {
		this.state.selection = selection;
		this.state.facets = {};
		this.state.visible = PAGE_SIZE;
		this.render();
	}

	private context(): ExplorerContext {
		return {
			view: this,
			model: this.deps.model,
			excerpts: this.deps.excerpts,
			settings: this.deps.settings,
			state: this.state,
			setSelection: (selection) => {
				this.state.selection = selection;
				this.state.visible = PAGE_SIZE;
				this.render();
			},
			setFacet: (name, value) => {
				if (value === null) {
					delete this.state.facets[name];
				} else {
					this.state.facets[name] = value;
				}
				this.state.visible = PAGE_SIZE;
				this.render();
			},
			clearFacets: () => {
				this.state.facets = {};
				this.state.visible = PAGE_SIZE;
				this.render();
			},
			toggleSection: (title) => {
				const open = this.deps.settings.expandedSections;
				const index = open.indexOf(title);
				if (index === -1) {
					open.push(title);
				} else {
					open.splice(index, 1);
				}
				void this.deps.saveSettings();
				this.render();
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
			refresh: () => this.render(),
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
		this.renderBody();
	}

	private renderBody(): void {
		if (!this.contentAreaEl) {
			return;
		}
		const context = this.context();
		renderRail(this.railEl, context);
		renderContent(this.contentAreaEl, context);
	}
}

const SMART_IDS: SmartListId[] = ['all', 'orphans', 'unresolved'];

function isSmartId(value: string): value is SmartListId {
	return SMART_IDS.some((id) => id === value);
}

function restoreSelection(kind: string, value: string): Selection {
	if (kind === 'folder') {
		return { kind: 'folder', value };
	}
	if (kind === 'tag') {
		return { kind: 'tag', value };
	}
	return { kind: 'smart', value: isSmartId(value) ? value : 'all' };
}
