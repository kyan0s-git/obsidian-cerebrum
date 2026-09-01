import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { BUILD_VERSION } from '../build-info';
import { detectRules } from '../core/facets';
import type CerebrumPlugin from '../main';

export class CerebrumSettingTab extends PluginSettingTab {
	private readonly plugin: CerebrumPlugin;

	constructor(app: App, plugin: CerebrumPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.plugin.settings;
		const save = (rebuild = false): void => {
			void this.plugin.saveSettings(rebuild);
		};

		new Setting(containerEl).setName('Browsing').setHeading();

		new Setting(containerEl)
			.setName('Open notes in a new tab')
			.setDesc(
				'Off, a click reuses the current tab. On, every click opens a tab. The modifier key always does the opposite.',
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.openInNewTab).onChange((value) => {
					settings.openInNewTab = value;
					save();
				}),
			);

		new Setting(containerEl)
			.setName('Show attachments')
			.setDesc('Include images, audio and other attachments alongside notes.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showAttachments).onChange((value) => {
					settings.showAttachments = value;
					save(true);
				}),
			);

		new Setting(containerEl)
			.setName('Hidden folders')
			.setDesc(
				'One folder path per line. Everything inside them is left out of both views.',
			)
			.addTextArea((area) =>
				area
					.setPlaceholder('Templates')
					.setValue(settings.excludedFolders.join('\n'))
					.onChange((value) => {
						settings.excludedFolders = value
							.split('\n')
							.map((line) => line.trim())
							.filter((line) => line !== '');
						save(true);
					}),
			);

		this.renderFacetSettings(containerEl);

		new Setting(containerEl).setName('Graph').setHeading();

		new Setting(containerEl)
			.setName('Include pages that do not exist yet')
			.setDesc('Draw links pointing at missing notes as hollow nodes.')
			.addToggle((toggle) =>
				toggle.setValue(settings.graphIncludeUnresolved).onChange((value) => {
					settings.graphIncludeUnresolved = value;
					save();
				}),
			);

		new Setting(containerEl)
			.setName('Include unlinked notes')
			.setDesc('Keep notes with no links in the graph instead of hiding them.')
			.addToggle((toggle) =>
				toggle.setValue(settings.graphIncludeOrphans).onChange((value) => {
					settings.graphIncludeOrphans = value;
					save();
				}),
			);

		new Setting(containerEl)
			.setName('Local graph depth')
			.setDesc('How many link steps around the active note the local graph follows.')
			.addSlider((slider) =>
				slider
					.setLimits(1, 4, 1)
					.setValue(settings.graphLocalDepth)
					.setDynamicTooltip()
					.onChange((value) => {
						settings.graphLocalDepth = value;
						save();
					}),
			);

		new Setting(containerEl)
			.setName('Show advanced options')
			.setDesc('Layout forces and limits. Most vaults never need these.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showAdvanced).onChange((value) => {
					settings.showAdvanced = value;
					save();
					this.display();
				}),
			);

		if (settings.showAdvanced) {
			this.renderAdvanced(containerEl);
		}

		this.renderBuildInfo(containerEl);
	}

	/** Tuning knobs, which are settings only in the sense that they are stored. */
	private renderAdvanced(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		const save = (): void => {
			void this.plugin.saveSettings();
		};

		new Setting(containerEl).setName('Layout').setHeading();

		new Setting(containerEl)
			.setName('Link distance')
			.setDesc('Resting length of a link in the layout.')
			.addSlider((slider) =>
				slider
					.setLimits(30, 250, 5)
					.setValue(settings.graphLinkDistance)
					.setDynamicTooltip()
					.onChange((value) => {
						settings.graphLinkDistance = value;
						save();
					}),
			);

		new Setting(containerEl)
			.setName('Repel strength')
			.setDesc('How hard nodes push each other apart.')
			.addSlider((slider) =>
				slider
					.setLimits(100, 3000, 50)
					.setValue(settings.graphRepelStrength)
					.setDynamicTooltip()
					.onChange((value) => {
						settings.graphRepelStrength = value;
						save();
					}),
			);

		new Setting(containerEl)
			.setName('Node limit')
			.setDesc('Stop adding nodes past this many, to keep large vaults smooth.')
			.addSlider((slider) =>
				slider
					.setLimits(200, 8000, 100)
					.setValue(settings.graphMaxNodes)
					.setDynamicTooltip()
					.onChange((value) => {
						settings.graphMaxNodes = value;
						save();
					}),
			);
	}

	/** The exact build in use, for bug reports. */
	private renderBuildInfo(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Build')
			.setDesc(BUILD_VERSION)
			.addButton((button) =>
				button.setButtonText('Copy').onClick(() => {
					void navigator.clipboard.writeText(BUILD_VERSION);
					new Notice('Build version copied.');
				}),
			);
	}

	/**
	 * Patterns name the folder levels once, and every note then carries those
	 * levels as filters that combine in any order.
	 */
	private renderFacetSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;

		new Setting(containerEl).setName('Levels').setHeading();

		new Setting(containerEl)
			.setName('Find levels automatically')
			.setDesc(
				'Reads nested tags such as status/active and frontmatter properties used across several notes, and offers each as a filter. No setup needed.',
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.autoFacets).onChange((value) => {
					settings.autoFacets = value;
					void this.plugin.saveSettings(true);
					this.display();
				}),
			);

		this.renderDiscoveredLevels(containerEl);

		new Setting(containerEl)
			.setName('Folder level patterns')
			.setDesc(
				'One pattern per line naming each folder level, such as raw/<year>/<subject>/<unit>. Leave this empty and the levels are worked out from your folders. Write <shelf=raw> to match one folder and record it as a level, which is how several trees of the same shape become one hierarchy. Anything nested deeper stays with the level above it, and a note can override a level in its own frontmatter.',
			)
			.addTextArea((area) => {
				area
					.setPlaceholder('raw/<year>/<subject>/<unit>')
					.setValue(settings.facetPatterns.join('\n'))
					.onChange((value) => {
						settings.facetPatterns = value
							.split('\n')
							.map((line) => line.trim())
							.filter((line) => line !== '');
						void this.plugin.saveSettings(true);
					});
				area.inputEl.rows = 4;
			});

		new Setting(containerEl)
			.setName('Hidden levels')
			.setDesc('Level names to leave out of the views, one per line.')
			.addTextArea((area) => {
				area
					.setPlaceholder('Status')
					.setValue(settings.hiddenFacets.join('\n'))
					.onChange((value) => {
						settings.hiddenFacets = value
							.split('\n')
							.map((line) => line.trim())
							.filter((line) => line !== '');
						void this.plugin.saveSettings(true);
					});
				area.inputEl.rows = 2;
			});

		new Setting(containerEl)
			.setName('Detect folder levels')
			.setDesc(
				'Writes out the patterns the plugin is already using, so you can rename the levels or correct them. Trees of the same shape are matched by the folder names they use rather than by depth, so a summary filed deeper than its source still lands in the same unit.',
			)
			.addButton((button) =>
				button.setButtonText('Detect').onClick(() => {
					const folders = this.plugin.model
						.getAllFolders()
						.map((folder) => folder.path)
						.filter((path) => path !== '');
					const detected = detectRules(folders);
					if (detected.length === 0) {
						new Notice('No folder levels to detect yet.');
						return;
					}
					settings.facetPatterns = detected;
					void this.plugin.saveSettings(true);
					this.display();
					new Notice(`Detected ${detected.length} patterns.`);
				}),
			);
	}

	/** What discovery found, so the automatic behaviour is never a mystery. */
	private renderDiscoveredLevels(containerEl: HTMLElement): void {
		if (!this.plugin.settings.autoFacets) {
			return;
		}
		const found = this.plugin.model.getFacetDefinitions();
		const setting = new Setting(containerEl).setName('Levels found');
		if (found.length === 0) {
			setting.setDesc(
				'Nothing yet. Nested tags and repeated frontmatter properties both become levels once a few notes share them.',
			);
			return;
		}
		setting.setDesc(
			found
				.map(
					(definition) =>
						`${definition.name} (${definition.source}, ${definition.coverage} notes)`,
				)
				.join(', '),
		);
	}
}
