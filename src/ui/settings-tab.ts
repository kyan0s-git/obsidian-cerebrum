import { App, PluginSettingTab, Setting } from 'obsidian';
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
			.setName('Show excerpts on cards')
			.setDesc('Reads the first lines of each note to preview what it covers.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showExcerpts).onChange((value) => {
					settings.showExcerpts = value;
					save();
				}),
			);

		new Setting(containerEl)
			.setName('Include notes from subfolders')
			.setDesc('Show everything nested inside a space instead of its top level only.')
			.addToggle((toggle) =>
				toggle.setValue(settings.showSubfolderContents).onChange((value) => {
					settings.showSubfolderContents = value;
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
			.setName('Recently edited window')
			.setDesc('How many days back the recently edited collection reaches.')
			.addSlider((slider) =>
				slider
					.setLimits(1, 90, 1)
					.setValue(settings.recentDays)
					.setDynamicTooltip()
					.onChange((value) => {
						settings.recentDays = value;
						save();
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
}
