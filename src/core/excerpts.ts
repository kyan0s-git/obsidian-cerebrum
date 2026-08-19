import { App, TFile, getFrontMatterInfo } from 'obsidian';
import { EXCERPT_LENGTH, EXCERPT_MAX_FILE_SIZE } from '../constants';

interface CachedExcerpt {
	modified: number;
	text: string;
}

/**
 * Reads the first readable sentences of a note so cards can show what a page is
 * about. Results are cached per file and invalidated by modification time, and
 * files are only read when a card actually asks for them.
 */
export class ExcerptStore {
	private cache = new Map<string, CachedExcerpt>();
	private pending = new Map<string, Promise<string>>();

	constructor(private readonly app: App) {}

	/** Cached excerpt, if this file has already been read. */
	peek(file: TFile): string | undefined {
		const cached = this.cache.get(file.path);
		return cached && cached.modified === file.stat.mtime
			? cached.text
			: undefined;
	}

	async get(file: TFile): Promise<string> {
		const cached = this.peek(file);
		if (cached !== undefined) {
			return cached;
		}
		const inFlight = this.pending.get(file.path);
		if (inFlight) {
			return inFlight;
		}
		const request = this.read(file);
		this.pending.set(file.path, request);
		try {
			return await request;
		} finally {
			this.pending.delete(file.path);
		}
	}

	forget(path: string): void {
		this.cache.delete(path);
	}

	clear(): void {
		this.cache.clear();
	}

	private async read(file: TFile): Promise<string> {
		if (file.extension !== 'md' || file.stat.size > EXCERPT_MAX_FILE_SIZE) {
			return '';
		}
		let text = '';
		try {
			const content = await this.app.vault.cachedRead(file);
			text = toPlainText(content);
		} catch (error) {
			console.debug('Cerebrum could not read', file.path, error);
			text = '';
		}
		this.cache.set(file.path, { modified: file.stat.mtime, text });
		return text;
	}
}

/** Strips frontmatter and the noisiest markdown syntax down to prose. */
export function toPlainText(content: string): string {
	const info = getFrontMatterInfo(content);
	let body = info.exists ? content.slice(info.contentStart) : content;

	body = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/^\s*#{1,6}\s+/gm, '')
		.replace(/^\s*>\s?/gm, '')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/!\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[*_~`]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (body.length <= EXCERPT_LENGTH) {
		return body;
	}
	const clipped = body.slice(0, EXCERPT_LENGTH);
	const lastSpace = clipped.lastIndexOf(' ');
	return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}
