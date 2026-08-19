import { setIcon } from 'obsidian';
import type { FolderEntry, Selection } from '../types';
import { colorFor } from '../utils/palette';
import { shortTag } from '../utils/format';
import { splitTag } from '../core/facets';
import { SMART_LISTS, countForSmartList, resolveCollection } from './collections';
import type { ExplorerContext } from './explorer-view';

const MAX_TAGS = 24;
const MAX_FACET_VALUES = 12;

/**
 * The left rail. Spaces are read from the vault every time it is drawn, so a
 * folder created anywhere (top level or nested) appears without configuration.
 */
export function renderRail(container: HTMLElement, ctx: ExplorerContext): void {
	container.empty();

	const collections = section(container, 'Vault');
	for (const list of SMART_LISTS) {
		railItem(collections, {
			label: list.label,
			icon: list.icon,
			count: countForSmartList(ctx.model, ctx.settings, list.id),
			active:
				ctx.state.selection.kind === 'smart' &&
				ctx.state.selection.value === list.id,
			onClick: () => {
				ctx.setSelection({ kind: 'smart', value: list.id });
			},
		});
	}

	renderFacets(container, ctx);

	const spaces = section(container, 'Spaces');
	const root = ctx.model.getFolder('');
	if (root && root.directCount > 0) {
		railItem(spaces, {
			label: root.name,
			icon: 'vault',
			count: root.directCount,
			active: isFolderSelected(ctx.state.selection, ''),
			onClick: () => {
				ctx.setSelection({ kind: 'folder', value: '' });
			},
		});
	}
	const visible = visibleFolders(ctx);
	if (visible.length === 0) {
		spaces.createDiv({
			cls: 'cerebrum-rail-empty',
			text: 'No folders yet. Anything you add shows up here.',
		});
	}
	for (const folder of visible) {
		railItem(spaces, {
			label: folder.name,
			icon: hasChildren(folder) ? 'folder-tree' : 'folder',
			count: folder.totalCount,
			depth: folder.depth - 1,
			accent: colorFor(folder.path.split('/')[0] ?? folder.name),
			active: isFolderSelected(ctx.state.selection, folder.path),
			onClick: () => {
				ctx.setSelection({ kind: 'folder', value: folder.path });
			},
		});
	}

	// A nested tag that became a level is already a section above; listing it
	// here as well would be the same filter twice under two different names.
	const levels = new Set(ctx.model.getFacetNames());
	const tags = ctx.model
		.getTags()
		.filter((entry) => !levels.has(splitTag(entry.tag)?.name ?? ''));
	if (tags.length > 0) {
		const tagSection = section(container, 'Tags');
		for (const entry of tags.slice(0, MAX_TAGS)) {
			railItem(tagSection, {
				label: shortTag(entry.tag),
				icon: 'tag',
				count: entry.count,
				active:
					ctx.state.selection.kind === 'tag' &&
					ctx.state.selection.value === entry.tag,
				onClick: () => {
					ctx.setSelection({ kind: 'tag', value: entry.tag });
				},
			});
		}
		if (tags.length > MAX_TAGS) {
			tagSection.createDiv({
				cls: 'cerebrum-rail-empty',
				text: `and ${tags.length - MAX_TAGS} more`,
			});
		}
	}
}

/**
 * The facet lists. Each one counts its values under the *other* active filters,
 * so picking a year leaves only the subjects taught that year, while still
 * showing every year so you can switch in one click.
 */
function renderFacets(container: HTMLElement, ctx: ExplorerContext): void {
	const names = ctx.model.getFacetNames();
	if (names.length === 0) {
		return;
	}
	// Facets narrow whatever collection is open, so they count against it.
	const scope = resolveCollection(
		ctx.model,
		ctx.settings,
		ctx.state.selection,
	).notes;

	for (const name of names) {
		const values = ctx.model.getFacetValues(scope, name, ctx.state.facets);
		const active = ctx.state.facets[name];
		if (values.length === 0 && active === undefined) {
			continue;
		}
		const items = section(container, capitalise(name));
		const shown = values.slice(0, MAX_FACET_VALUES);
		if (active !== undefined && !shown.some((v) => v.value === active)) {
			// Keep the chosen value visible even when it falls outside the top slice.
			shown.unshift({ value: active, count: 0 });
		}
		for (const entry of shown) {
			const isActive = active === entry.value;
			railItem(items, {
				label: entry.value,
				icon: isActive ? 'check' : 'chevron-right',
				count: entry.count,
				accent: colorFor(`${name}:${entry.value}`),
				active: isActive,
				onClick: () => {
					ctx.setFacet(name, isActive ? null : entry.value);
				},
			});
		}
		if (values.length > shown.length) {
			items.createDiv({
				cls: 'cerebrum-rail-empty',
				text: `and ${values.length - shown.length} more`,
			});
		}
	}
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function section(container: HTMLElement, title: string): HTMLElement {
	const wrapper = container.createDiv({ cls: 'cerebrum-rail-section' });
	wrapper.createDiv({ cls: 'cerebrum-rail-title', text: title });
	return wrapper.createDiv({ cls: 'cerebrum-rail-items' });
}

interface RailItemOptions {
	label: string;
	icon: string;
	count: number;
	active: boolean;
	depth?: number;
	accent?: string;
	onClick: () => void;
}

function railItem(container: HTMLElement, options: RailItemOptions): void {
	const item = container.createDiv({
		cls: options.active ? 'cerebrum-rail-item is-active' : 'cerebrum-rail-item',
	});
	item.setCssProps({
		'--cerebrum-depth': String(options.depth ?? 0),
		'--cerebrum-accent': options.accent ?? 'var(--text-muted)',
	});
	setIcon(item.createSpan({ cls: 'cerebrum-rail-icon' }), options.icon);
	item.createSpan({ cls: 'cerebrum-rail-label', text: options.label });
	item.createSpan({ cls: 'cerebrum-rail-count', text: String(options.count) });
	item.addEventListener('click', options.onClick);
}

function isFolderSelected(selection: Selection, path: string): boolean {
	return selection.kind === 'folder' && selection.value === path;
}

function hasChildren(folder: FolderEntry): boolean {
	return folder.childFolders.length > 0;
}

/**
 * Top level folders, plus the children of whichever folder chain is currently
 * open, so drilling down never means losing sight of the rest of the vault.
 */
function visibleFolders(ctx: ExplorerContext): FolderEntry[] {
	const selection = ctx.state.selection;
	const activePath = selection.kind === 'folder' ? selection.value : '';
	const result: FolderEntry[] = [];

	const walk = (parentPath: string): void => {
		for (const folder of ctx.model.getChildFolders(parentPath)) {
			result.push(folder);
			const onActivePath =
				activePath === folder.path ||
				activePath.startsWith(`${folder.path}/`);
			if (onActivePath) {
				walk(folder.path);
			}
		}
	};
	walk('');
	return result;
}
