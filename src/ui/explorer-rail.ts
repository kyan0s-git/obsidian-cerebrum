import { setIcon } from 'obsidian';
import { splitTag } from '../core/facets';
import type { FolderEntry, Selection } from '../types';
import { colorFor } from '../utils/palette';
import { shortTag } from '../utils/format';
import { SMART_LISTS, countForSmartList, resolveCollection } from './collections';
import type { ExplorerContext } from './explorer-view';

const MAX_TAGS = 24;
const MAX_FACET_VALUES = 12;

/**
 * The left rail.
 *
 * Every section past the first is collapsed until you open it. A vault with a
 * dozen dimensions then reads as a dozen labelled rows rather than a dozen
 * lists at once, and the ones you actually browse by stay open because the
 * choice is remembered.
 */
export function renderRail(container: HTMLElement, ctx: ExplorerContext): void {
	container.empty();

	const vault = section(container, ctx, 'Vault', { alwaysOpen: true });
	for (const list of SMART_LISTS) {
		railItem(vault.items, {
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

	renderLevels(container, ctx);
	renderSpaces(container, ctx);
	renderTags(container, ctx);
}

/**
 * One section per level. Values are counted under the *other* active filters,
 * so picking a year leaves only the subjects taught that year, while still
 * showing every year so you can switch in one click.
 */
function renderLevels(container: HTMLElement, ctx: ExplorerContext): void {
	const names = ctx.model.getFacetNames();
	if (names.length === 0) {
		return;
	}
	// Levels narrow whatever collection is open, so they count against it.
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
		const level = section(container, ctx, capitalise(name), {
			// A level you are filtering by stays open, whatever the saved state.
			alwaysOpen: active !== undefined,
			count: values.length,
			summary: active,
		});
		if (level.collapsed) {
			continue;
		}
		const shown = values.slice(0, MAX_FACET_VALUES);
		if (active !== undefined && !shown.some((v) => v.value === active)) {
			shown.unshift({ value: active, count: 0 });
		}
		for (const entry of shown) {
			const isActive = active === entry.value;
			railItem(level.items, {
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
			level.items.createDiv({
				cls: 'cerebrum-rail-empty',
				text: `and ${values.length - shown.length} more`,
			});
		}
	}
}

function renderSpaces(container: HTMLElement, ctx: ExplorerContext): void {
	const selection = ctx.state.selection;
	const visible = visibleFolders(ctx);
	const root = ctx.model.getFolder('');
	const spaces = section(container, ctx, 'Folders', {
		alwaysOpen: selection.kind === 'folder',
		count: visible.length,
		summary: selection.kind === 'folder' ? selection.value : undefined,
	});
	if (spaces.collapsed) {
		return;
	}

	if (root && root.directCount > 0) {
		railItem(spaces.items, {
			label: root.name,
			icon: 'vault',
			count: root.directCount,
			active: isFolderSelected(selection, ''),
			onClick: () => {
				ctx.setSelection({ kind: 'folder', value: '' });
			},
		});
	}
	if (visible.length === 0) {
		spaces.items.createDiv({
			cls: 'cerebrum-rail-empty',
			text: 'No folders yet. Anything you add shows up here.',
		});
	}
	for (const folder of visible) {
		railItem(spaces.items, {
			label: folder.name,
			icon: folder.childFolders.length > 0 ? 'folder-tree' : 'folder',
			count: folder.totalCount,
			depth: folder.depth - 1,
			accent: colorFor(folder.path.split('/')[0] ?? folder.name),
			active: isFolderSelected(selection, folder.path),
			onClick: () => {
				ctx.setSelection({ kind: 'folder', value: folder.path });
			},
		});
	}
}

function renderTags(container: HTMLElement, ctx: ExplorerContext): void {
	// A nested tag that became a level is already a section above; listing it
	// here as well would be the same filter twice under two different names.
	const levels = new Set(ctx.model.getFacetNames());
	const tags = ctx.model
		.getTags()
		.filter((entry) => !levels.has(splitTag(entry.tag)?.name ?? ''));
	if (tags.length === 0) {
		return;
	}
	const selection = ctx.state.selection;
	const tagSection = section(container, ctx, 'Tags', {
		alwaysOpen: selection.kind === 'tag',
		count: tags.length,
		summary: selection.kind === 'tag' ? selection.value : undefined,
	});
	if (tagSection.collapsed) {
		return;
	}
	for (const entry of tags.slice(0, MAX_TAGS)) {
		railItem(tagSection.items, {
			label: shortTag(entry.tag),
			icon: 'tag',
			count: entry.count,
			active: selection.kind === 'tag' && selection.value === entry.tag,
			onClick: () => {
				ctx.setSelection({ kind: 'tag', value: entry.tag });
			},
		});
	}
	if (tags.length > MAX_TAGS) {
		tagSection.items.createDiv({
			cls: 'cerebrum-rail-empty',
			text: `and ${tags.length - MAX_TAGS} more`,
		});
	}
}

interface SectionOptions {
	/** Open regardless of the saved state, because it is in use. */
	alwaysOpen?: boolean;
	count?: number;
	/** Shown on the closed header, so a section says what it is doing. */
	summary?: string;
}

interface SectionHandle {
	items: HTMLElement;
	collapsed: boolean;
}

function section(
	container: HTMLElement,
	ctx: ExplorerContext,
	title: string,
	options: SectionOptions = {},
): SectionHandle {
	const wrapper = container.createDiv({ cls: 'cerebrum-rail-section' });
	const collapsed =
		options.alwaysOpen !== true &&
		!ctx.settings.expandedSections.includes(title);

	const header = wrapper.createDiv({
		cls: collapsed
			? 'cerebrum-rail-title is-collapsed'
			: 'cerebrum-rail-title',
	});
	setIcon(
		header.createSpan({ cls: 'cerebrum-rail-caret' }),
		collapsed ? 'chevron-right' : 'chevron-down',
	);
	header.createSpan({ cls: 'cerebrum-rail-title-text', text: title });
	if (collapsed && options.summary !== undefined && options.summary !== '') {
		header.createSpan({
			cls: 'cerebrum-rail-summary',
			text: options.summary,
		});
	} else if (options.count !== undefined) {
		header.createSpan({
			cls: 'cerebrum-rail-count',
			text: String(options.count),
		});
	}
	if (options.alwaysOpen !== true) {
		header.addEventListener('click', () => {
			ctx.toggleSection(title);
		});
	}

	return {
		items: wrapper.createDiv({ cls: 'cerebrum-rail-items' }),
		collapsed,
	};
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
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
				activePath === folder.path || activePath.startsWith(`${folder.path}/`);
			if (onActivePath) {
				walk(folder.path);
			}
		}
	};
	walk('');
	return result;
}
