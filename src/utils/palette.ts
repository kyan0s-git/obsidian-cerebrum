/**
 * Colours are derived from the folder name itself rather than a fixed list, so
 * a folder added to the vault gets a stable colour immediately and keeps it
 * across restarts without any bookkeeping.
 */
const HUES = [
	205, 262, 330, 12, 32, 48, 96, 152, 172, 188, 285, 350,
];

function hash(value: string): number {
	let result = 2166136261;
	for (let index = 0; index < value.length; index++) {
		result ^= value.charCodeAt(index);
		result = Math.imul(result, 16777619);
	}
	return Math.abs(result);
}

export function hueFor(key: string): number {
	if (key === '') {
		return 220;
	}
	return HUES[hash(key) % HUES.length] ?? 220;
}

/** Colour used for graph nodes and space badges. */
export function colorFor(key: string, alpha = 1): string {
	if (key === '') {
		return `hsla(220, 12%, 62%, ${alpha})`;
	}
	return `hsla(${hueFor(key)}, 62%, 58%, ${alpha})`;
}

/** Softer variant used for backgrounds behind text. */
export function softColorFor(key: string): string {
	return colorFor(key, 0.18);
}
