import { App, WorkspaceLeaf } from 'obsidian';
import { EXPLORER_VIEW_TYPE, GRAPH_VIEW_TYPE } from '../constants';

/**
 * Opens a view in the main area, reusing an open tab of the same type so the
 * workspace does not fill up with duplicates.
 */
export async function activateView(
	app: App,
	type: string,
	state: Record<string, unknown> = {},
	forceNewTab = false,
): Promise<void> {
	const existing = app.workspace.getLeavesOfType(type);
	let leaf: WorkspaceLeaf | undefined = forceNewTab ? undefined : existing[0];
	leaf ??= app.workspace.getLeaf('tab');
	await leaf.setViewState({ type, active: true, state });
	await app.workspace.revealLeaf(leaf);
}

export async function openExplorer(
	app: App,
	state: Record<string, unknown> = {},
): Promise<void> {
	await activateView(app, EXPLORER_VIEW_TYPE, state);
}

export async function openGraph(
	app: App,
	state: Record<string, unknown> = {},
): Promise<void> {
	await activateView(app, GRAPH_VIEW_TYPE, state);
}
