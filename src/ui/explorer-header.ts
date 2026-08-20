import { setIcon, setTooltip } from 'obsidian';
import { resolvePlace } from '../core/navigation';
import type { Density, SortKey } from '../types';
import { formatCount } from '../utils/format';
import type { ExplorerContext } from './explorer-view';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: 'newest', label: 'Newest first' },
	{ value: 'oldest', label: 'Oldest first' },
	{ value: 'title', label: 'Title A to Z' },
	{ value: 'title-desc', label: 'Title Z to A' },
	{ value: 'links', label: 'Most linked' },
];

/**
 * The header carries the two things every screen needs: where you are, and the
 * way back. Controls come after that, and only the ones that change what you
 * are looking at rather than how it is filed.
 */
export function renderHeader(
	container: HTMLElement,
	ctx: ExplorerContext,
): void {
	container.empty();

	renderCrumbs(container, ctx);
	renderTitle(container, ctx);

	const toolbar = container.createDiv({ cls: 'cerebrum-toolbar' });
	renderSearch(toolbar, ctx);
	renderSort(toolbar, ctx);
	renderDensity(toolbar, ctx);
}

function renderCrumbs(container: HTMLElement, ctx: ExplorerContext): void {
	const crumbs = container.createDiv({ cls: 'cerebrum-crumbs' });
	const state = ctx.state;

	const crumb = (
		label: string,
		go: (() => void) | null,
		icon?: string,
	): void => {
		const el = crumbs.createEl(go ? 'a' : 'span', {
			cls: go ? 'cerebrum-crumb is-clickable' : 'cerebrum-crumb',
		});
		if (icon) {
			setIcon(el.createSpan({ cls: 'cerebrum-crumb-icon' }), icon);
		}
		el.createSpan({ text: label });
		if (go) {
			el.addEventListener('click', go);
		}
	};
	const separator = (): void => {
		setIcon(
			crumbs.createSpan({ cls: 'cerebrum-crumb-sep' }),
			'chevron-right',
		);
	};

	const home = (): void => {
		ctx.go({ screen: 'browse', trail: [], tag: '', query: '' });
	};

	if (state.screen !== 'browse') {
		crumb('Home', home, 'home');
		separator();
		if (state.screen === 'tag') {
			crumb('Tags', () => {
				ctx.go({ screen: 'tags', tag: '', query: '' });
			});
			separator();
			crumb(state.tag, null);
			return;
		}
		crumb(screenLabel(state.screen), null);
		return;
	}

	const place = resolvePlace(ctx.model, ctx.settings, state.trail);
	place.crumbs.forEach((entry, index) => {
		const isLast = index === place.crumbs.length - 1;
		if (index > 0) {
			separator();
		}
		crumb(
			entry.label,
			isLast
				? null
				: () => {
						ctx.go({ screen: 'browse', trail: entry.trail, query: '' });
					},
			index === 0 ? 'home' : undefined,
		);
	});
}

/** The heading, and what this screen holds. */
function renderTitle(container: HTMLElement, ctx: ExplorerContext): void {
	const state = ctx.state;
	const row = container.createDiv({ cls: 'cerebrum-intro' });

	if (state.screen !== 'browse') {
		row.createDiv({
			cls: 'cerebrum-intro-title',
			text: state.screen === 'tag' ? state.tag : screenLabel(state.screen),
		});
		return;
	}

	const place = resolvePlace(ctx.model, ctx.settings, state.trail);
	const vaultName = ctx.model.getFolder('')?.name ?? 'Cerebrum';
	row.createDiv({
		cls: 'cerebrum-intro-title',
		text: state.trail.length === 0 ? vaultName : place.title,
	});

	const parts: string[] = [];
	if (place.children.length > 0 && place.childLabel !== '') {
		parts.push(`${place.children.length} ${place.childLabel.toLowerCase()}`);
	}
	parts.push(formatCount(place.allNotes.length, 'note'));
	row.createDiv({ cls: 'cerebrum-intro-count', text: parts.join(' · ') });
}

function renderSearch(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const wrapper = toolbar.createDiv({ cls: 'cerebrum-search' });
	setIcon(wrapper.createSpan({ cls: 'cerebrum-search-icon' }), 'search');
	const input = wrapper.createEl('input', {
		type: 'search',
		cls: 'cerebrum-search-input',
		attr: {
			placeholder:
				ctx.state.screen === 'browse' && ctx.state.trail.length > 0
					? 'Search here'
					: 'Search notes',
		},
	});
	input.value = ctx.state.query;
	// Only the results redraw while typing, so the caret stays put.
	input.addEventListener('input', () => {
		ctx.setQuery(input.value);
	});
}

function renderSort(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const select = toolbar.createEl('select', { cls: 'dropdown cerebrum-select' });
	for (const option of SORT_OPTIONS) {
		select.createEl('option', { value: option.value, text: option.label });
	}
	select.value = ctx.settings.sortKey;
	setTooltip(select, 'Order');
	select.addEventListener('change', () => {
		const chosen = SORT_OPTIONS.find(
			(option) => option.value === select.value,
		);
		if (chosen) {
			ctx.settings.sortKey = chosen.value;
			ctx.persist();
		}
	});
}

/** One control for how much room a note gets, rather than two layouts. */
function renderDensity(toolbar: HTMLElement, ctx: ExplorerContext): void {
	const group = toolbar.createDiv({ cls: 'cerebrum-mode-toggle' });
	const options: { value: Density; icon: string; label: string }[] = [
		{ value: 'comfortable', icon: 'rows-3', label: 'Comfortable' },
		{ value: 'compact', icon: 'rows-4', label: 'Compact' },
	];
	for (const option of options) {
		const button = group.createEl('button', {
			cls:
				ctx.settings.density === option.value
					? 'clickable-icon is-active'
					: 'clickable-icon',
		});
		setIcon(button, option.icon);
		setTooltip(button, option.label);
		button.addEventListener('click', () => {
			ctx.settings.density = option.value;
			ctx.persist();
		});
	}
}

function screenLabel(screen: string): string {
	switch (screen) {
		case 'tags':
			return 'Tags';
		case 'all':
			return 'All notes';
		case 'loose':
			return 'Loose ends';
		default:
			return 'Home';
	}
}
