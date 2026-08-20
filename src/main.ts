import {
	Menu,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
	debounce,
} from 'obsidian';
import {
	EXPLORER_ICON,
	EXPLORER_VIEW_TYPE,
	GRAPH_ICON,
	GRAPH_VIEW_TYPE,
	INDEX_DEBOUNCE_MS,
} from './constants';
import { ExcerptStore } from './core/excerpts';
import { FOLDER_AXIS } from './core/navigation';
import { VaultModel } from './core/vault-model';
import { CerebrumSettings, mergeSettings } from './settings';
import { ExplorerView } from './ui/explorer-view';
import { GraphView } from './ui/graph-view';
import { CerebrumSettingTab } from './ui/settings-tab';
import { openExplorer, openGraph } from './ui/view-actions';

export default class CerebrumPlugin extends Plugin {
	settings!: CerebrumSettings;
	model!: VaultModel;
	excerpts!: ExcerptStore;

	private reindex = debounce(() => {
		this.model.rebuild();
	}, INDEX_DEBOUNCE_MS, true);

	async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
		this.model = new VaultModel(this.app, () => this.settings);
		this.excerpts = new ExcerptStore(this.app);

		this.registerView(
			EXPLORER_VIEW_TYPE,
			(leaf) =>
				new ExplorerView(leaf, {
					model: this.model,
					excerpts: this.excerpts,
					settings: this.settings,
					saveSettings: () => this.saveSettings(),
				}),
		);
		this.registerView(
			GRAPH_VIEW_TYPE,
			(leaf) =>
				new GraphView(leaf, {
					model: this.model,
					settings: this.settings,
					saveSettings: () => this.saveSettings(),
				}),
		);

		this.addRibbonIcon(EXPLORER_ICON, 'Browse the vault', () => {
			void openExplorer(this.app);
		});
		this.addRibbonIcon(GRAPH_ICON, 'Open the link graph', () => {
			void openGraph(this.app);
		});

		this.registerCommands();
		this.registerVaultEvents();
		this.registerMenus();

		this.registerHoverLinkSource(EXPLORER_VIEW_TYPE, {
			display: 'Cerebrum',
			defaultMod: true,
		});

		this.addSettingTab(new CerebrumSettingTab(this.app, this));

		// The metadata cache is not ready during onload, so wait for the layout.
		this.app.workspace.onLayoutReady(() => {
			this.model.rebuild();
		});
	}

	async saveSettings(rebuildIndex = false): Promise<void> {
		await this.saveData(this.settings);
		if (rebuildIndex) {
			this.excerpts.clear();
			this.model.rebuild();
		} else {
			this.model.notify();
		}
	}

	private registerCommands(): void {
		this.addCommand({
			id: 'open-explorer',
			name: 'Browse the vault',
			callback: () => {
				void openExplorer(this.app);
			},
		});
		this.addCommand({
			id: 'open-graph',
			name: 'Open the link graph',
			callback: () => {
				void openGraph(this.app);
			},
		});
		this.addCommand({
			id: 'open-local-graph',
			name: 'Show the active note in the link graph',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					return false;
				}
				if (!checking) {
					void openGraph(this.app, { focusPath: file.path, query: '' });
				}
				return true;
			},
		});
		this.addCommand({
			id: 'reveal-active-note',
			name: 'Show where the active note sits',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					return false;
				}
				if (!checking) {
					void openExplorer(this.app, {
						screen: 'browse',
						trail: this.trailTo(file.path),
						query: '',
					});
				}
				return true;
			},
		});
		this.addCommand({
			id: 'rebuild-index',
			name: 'Rebuild the index',
			callback: () => {
				this.excerpts.clear();
				this.model.rebuild();
			},
		});
	}

	private registerVaultEvents(): void {
		const onChange = (file: TAbstractFile): void => {
			if (file instanceof TFile) {
				this.excerpts.forget(file.path);
			}
			this.reindex();
		};

		this.registerEvent(this.app.vault.on('create', onChange));
		this.registerEvent(this.app.vault.on('delete', onChange));
		this.registerEvent(this.app.vault.on('modify', onChange));
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				this.excerpts.forget(oldPath);
				onChange(file);
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on('resolved', () => {
				this.reindex();
			}),
		);
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.forEachGraphView((view) => {
					view.onActiveFileChanged(file);
				});
			}),
		);
		this.registerEvent(
			this.app.workspace.on('css-change', () => {
				this.forEachGraphView((view) => {
					view.refreshTheme();
				});
			}),
		);
	}

	private registerMenus(): void {
		this.registerEvent(
			this.app.workspace.on(
				'file-menu',
				(menu: Menu, file: TAbstractFile, source: string) => {
					if (file instanceof TFile) {
						menu.addItem((item) =>
							item
								.setTitle('Show links in graph')
								.setIcon(GRAPH_ICON)
								.onClick(() => {
									void openGraph(this.app, {
										focusPath: file.path,
										query: '',
									});
								}),
						);
					}
					if (file instanceof TFolder && source !== EXPLORER_VIEW_TYPE) {
						menu.addItem((item) =>
							item
								.setTitle('Browse this folder')
								.setIcon(EXPLORER_ICON)
								.onClick(() => {
									void openExplorer(this.app, {
										screen: 'browse',
										trail: file.isRoot()
											? []
											: [{ name: FOLDER_AXIS, value: file.path }],
										query: '',
									});
								}),
						);
					}
				},
			),
		);
	}

	/**
	 * The walk that leads to a note: its own level values in order, so revealing
	 * a note lands you where it lives rather than in a flat list of everything.
	 */
	private trailTo(path: string): { name: string; value: string }[] {
		const note = this.model.getNote(path);
		if (!note) {
			return [];
		}
		const names = this.model.getFacetNames();
		if (names.length === 0) {
			const folder = note.folder;
			return folder === '' ? [] : [{ name: FOLDER_AXIS, value: folder }];
		}
		const trail: { name: string; value: string }[] = [];
		for (const name of names) {
			const value = note.facets[name]?.[0];
			if (value === undefined) {
				break;
			}
			trail.push({ name, value });
		}
		return trail;
	}

	/** Views are looked up on demand so no references outlive their leaf. */
	private forEachGraphView(callback: (view: GraphView) => void): void {
		for (const leaf of this.app.workspace.getLeavesOfType(GRAPH_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof GraphView) {
				callback(view);
			}
		}
	}
}
