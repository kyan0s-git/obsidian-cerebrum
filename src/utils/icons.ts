import type { IconName } from 'obsidian';

const ICONS_BY_EXTENSION: Record<string, IconName> = {
	md: 'file-text',
	canvas: 'layout-dashboard',
	pdf: 'file-type',
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	gif: 'image',
	svg: 'image',
	webp: 'image',
	avif: 'image',
	mp3: 'audio-lines',
	wav: 'audio-lines',
	m4a: 'audio-lines',
	ogg: 'audio-lines',
	flac: 'audio-lines',
	mp4: 'film',
	webm: 'film',
	mov: 'film',
	mkv: 'film',
	json: 'braces',
	base: 'table',
};

export function iconForExtension(extension: string): IconName {
	return ICONS_BY_EXTENSION[extension.toLowerCase()] ?? 'file';
}
