import { setIcon, setTooltip } from 'obsidian';
import type { GroupKey, Selection, SortKey } from '../types';
import type { ExplorerContext } from './explorer-view';
import { openGraph } from './view-actions';
import { SMART_LISTS } from './collections';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: 'modified', label: 'Last modified' },
	{ value: 'created', label: 'Date created' },
	{ value: 'name', label: 'Title' },
	{ value: 'links', label: 'Link count' },
];

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
	{ value: 'none', label: 'No grouping' },
	{ value: 'folder', label: 'Group by folder' },
	{ value: 'space', label: 'Group by space' },
	{ value: 'tag', label: 'Group by tag' },
	{ value: 'modified', label: 'Group by date' },
];

export function renderHeader(container: HTMLElement, ctx: ExplorerContext): void {
	container.empty();

	renderBreadcrumbs(container.createDiv({ cls: 'cerebrum-crumbs' }), ctx);

	const toolbar = container.createDiv({ cls: 'cerebrum-toolbar' });
	renderSearch(toolbar, ctx);
	renderSelect(
		toolbar,
		SORT_OPTIONS,
		ctx.settings.sortKey,
		'Sort notes',
		(value) => {
			ctx.settings.sortKey = value;
			ctx.persist();
		},
	);
	renderDirectionToggle(toolbar, ctx);
	renderSelect(
		toolbar,
		GROUP_OPTIONS,
		ctx.settings.groupKey,
		'Group notes',
		(value) => {
			ctx.settings.groupKey = value;
			ctx.persist();
		},
	);
	renderModeToggle(toolbar, ctx);
	renderGraphButton(toolbar, ctx);
}

function renderBreadcrumbs(container: HTMLElement, ctx: ExplorerContext): void {
	const selection = ctx.state.selection;
	const crumb = (
		label: string,
		icon: string | null,
		target: Selection | null,
	): void => {
		const el = container.createEl(target ? 'a' : 'span', {
			cls: target ? 'cerebrum-crumb is-clickable' : 'cerebrum-crumb',
		});
		if (icon) {
			setIcon(el.createSpan({ cls: 'cerebrum-crumb-icon' }), icon);
		}
		el.createSpan({ text: label });
		if (target) {
			el.addEventListener('click', () => {
				ctx.setSelection(target);
			});
		}
	};
	const separator = (): void => {
		setIcon(container.createSpan({ cls: 'cerebrum-crumb-sep' }), 'chevron-right');
	};

	if (selection.kind === 'smart') {
		const list = SMART_LISTS.find((item) => item.id === selection.value);
		crumb(list?.label ?? 'All notes', list?.icon ?? 'library', null);
		return;
	}

	if (selection.kind === 'tag') {
		crumb('Tags', 'tags', { kind: 'smart', value: 'all' });
		separator();
		crumb(selection.value, null, null);
		return;
	}

	crumb(ctx.model.getFolder('')?.name ?? 'Vault', 'vault', {
		kind: 'smart',
		value: 'all',
	});
	if (selection.value === '') {
		return;
	}
	const segments = selection.value.split('/');
	let path = '';
	for (const segment of segments) {
		path = path === '' ? segment : `${path}/${segment}`;
		separator();
		const isLast = path === selection.value;
		crumb(segment, null, isLast ? null : { kind: 'folder', value: path });
	}
}

function renderSearch(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const wrapper = toolbar.createDiv({ cls: 'cerebrum-search' });
	setIcon(wrapper.createSpan({ cls: 'cerebrum-search-icon' }), 'search');
	const input = wrapper.createEl('input', {
		type: 'search',
		cls: 'cerebrum-search-input',
		attr: { placeholder: 'Search titles, paths, tags and aliases' },
	});
	input.value = ctx.state.query;
	// Only the results re-render while typing, so the caret stays put.
	input.addEventListener('input', () => {
		ctx.setQuery(input.value);
	});
}

function renderSelect<T extends string>(
	toolbar: HTMLElement,
	options: { value: T; label: string }[],
	current: T,
	tooltip: string,
	onChange: (value: T) => void,
): void {
	const select = toolbar.createEl('select', { cls: 'dropdown cerebrum-select' });
	for (const option of options) {
		select.createEl('option', { value: option.value, text: option.label });
	}
	select.value = current;
	setTooltip(select, tooltip);
	select.addEventListener('change', () => {
		const chosen = options.find((option) => option.value === select.value);
		if (chosen) {
			onChange(chosen.value);
		}
	});
}

function renderDirectionToggle(
	toolbar: HTMLElement,
	ctx: ExplorerContext,
): void {
	const button = toolbar.createEl('button', { cls: 'clickable-icon' });
	const descending = ctx.settings.sortDescending;
	setIcon(button, descending ? 'arrow-down-wide-narrow' : 'arrow-up-narrow-wide');
	setTooltip(button, descending ? 'Sort descending' : 'Sort ascending');
	button.addEventListener('click', () => {
		ctx.settings.sortDescending = !ctx.settings.sortDescending;
		ctx.persist();
	});
}

function renderModeToggle(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const group = toolbar.createDiv({ cls: 'cerebrum-mode-toggle' });
	const modes: { value: 'cards' | 'list'; icon: string; label: string }[] = [
		{ value: 'cards', icon: 'layout-grid', label: 'Card layout' },
		{ value: 'list', icon: 'list', label: 'List layout' },
	];
	for (const mode of modes) {
		const button = group.createEl('button', {
			cls:
				ctx.settings.viewMode === mode.value
					? 'clickable-icon is-active'
					: 'clickable-icon',
		});
		setIcon(button, mode.icon);
		setTooltip(button, mode.label);
		button.addEventListener('click', () => {
			ctx.settings.viewMode = mode.value;
			ctx.persist();
		});
	}
}

function renderGraphButton(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const button = toolbar.createEl('button', { cls: 'clickable-icon' });
	setIcon(button, 'git-fork');
	setTooltip(button, 'Show this selection in the graph');
	button.addEventListener('click', () => {
		const selection = ctx.state.selection;
		const query =
			selection.kind === 'folder' || selection.kind === 'tag'
				? selection.value
				: ctx.state.query;
		void openGraph(ctx.view.app, { query, focusPath: null });
	});
}
