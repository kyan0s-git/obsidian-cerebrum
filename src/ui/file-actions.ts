import { App, Component, Keymap, Menu, TFile } from 'obsidian';

/** Opens a file, honouring the modifier keys used on the click. */
export function openFile(app: App, file: TFile, evt?: MouseEvent): void {
	const mode = evt ? Keymap.isModEvent(evt) : false;
	void app.workspace.getLeaf(mode).openFile(file);
}

/** Opens a link by its text, used for links that may not exist yet. */
export function openLink(
	app: App,
	linktext: string,
	sourcePath: string,
	evt?: MouseEvent,
): void {
	const mode = evt ? Keymap.isModEvent(evt) : false;
	void app.workspace.openLinkText(linktext, sourcePath, mode);
}

/**
 * Lets the page preview core plugin show its popover for a card, using the
 * hover link source the plugin registers on load.
 */
export function wireHoverPreview(
	app: App,
	el: HTMLElement,
	file: TFile,
	source: string,
	hoverParent: Component,
): void {
	el.addEventListener('mouseover', (evt: MouseEvent) => {
		app.workspace.trigger('hover-link', {
			event: evt,
			source,
			hoverParent,
			targetEl: el,
			linktext: file.path,
			sourcePath: file.path,
		});
	});
}

/**
 * Shows the standard file menu, so every entry other plugins contribute keeps
 * working, on top of the two shortcuts added here.
 */
export function showFileMenu(
	app: App,
	file: TFile,
	evt: MouseEvent,
	source: string,
): void {
	const menu = new Menu();
	menu.addItem((item) =>
		item
			.setTitle('Open in new tab')
			.setIcon('file-plus')
			.onClick(() => {
				void app.workspace.getLeaf('tab').openFile(file);
			}),
	);
	menu.addItem((item) =>
		item
			.setTitle('Open to the right')
			.setIcon('separator-vertical')
			.onClick(() => {
				void app.workspace.getLeaf('split').openFile(file);
			}),
	);
	menu.addSeparator();
	app.workspace.trigger('file-menu', menu, file, source);
	menu.showAtMouseEvent(evt);
}
