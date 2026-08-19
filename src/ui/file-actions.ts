import { App, Component, Keymap, Menu, PaneType, TFile } from 'obsidian';

/**
 * Where a plain click should open a note, and what the modifier keys do to
 * that. The modifier always means "the other one", so whichever default you
 * choose, the opposite stays one keypress away.
 */
export function resolvePaneType(
	openInNewTab: boolean,
	evt?: MouseEvent,
): PaneType | boolean {
	// Middle click means a new tab everywhere else in Obsidian; keep it that way.
	if (evt?.button === 1) {
		return 'tab';
	}
	const modified = evt ? Keymap.isModEvent(evt) : false;
	// Cmd/Ctrl+Alt and friends ask for a specific pane: respect that as written.
	if (typeof modified === 'string' && modified !== 'tab') {
		return modified;
	}
	const wantsNewTab = modified === 'tab' || modified === true;
	return wantsNewTab === openInNewTab ? false : 'tab';
}

/** Opens a file in the current tab or a new one, per settings and modifiers. */
export function openFile(
	app: App,
	file: TFile,
	openInNewTab: boolean,
	evt?: MouseEvent,
): void {
	void app.workspace.getLeaf(resolvePaneType(openInNewTab, evt)).openFile(file);
}

/** Opens a link by its text, used for links that may not exist yet. */
export function openLink(
	app: App,
	linktext: string,
	sourcePath: string,
	openInNewTab: boolean,
	evt?: MouseEvent,
): void {
	void app.workspace.openLinkText(
		linktext,
		sourcePath,
		resolvePaneType(openInNewTab, evt),
	);
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
