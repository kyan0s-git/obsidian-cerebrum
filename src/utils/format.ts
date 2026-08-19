/** Human friendly relative time, falling back to a date for older items. */
export function formatRelativeTime(timestamp: number): string {
	if (!Number.isFinite(timestamp) || timestamp <= 0) {
		return '';
	}
	const seconds = Math.round((Date.now() - timestamp) / 1000);
	if (seconds < 60) {
		return 'just now';
	}
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.round(hours / 24);
	if (days < 7) {
		return `${days}d ago`;
	}
	if (days < 365) {
		return new Date(timestamp).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
		});
	}
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
	});
}

export function formatCount(count: number, singular: string): string {
	return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/** Trims a tag to its last segment for compact display. */
export function shortTag(tag: string): string {
	const parts = tag.replace(/^#/, '').split('/');
	return parts[parts.length - 1] ?? tag;
}

/** Path shown under a card title, without the file name itself. */
export function formatFolder(folder: string): string {
	return folder === '' ? 'Vault root' : folder;
}
