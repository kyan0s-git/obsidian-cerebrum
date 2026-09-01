/*
 * Guards the stylesheet against the one CSS mistake that does not degrade.
 *
 * `gap: var(--size-4-7)` is not a few pixels out — the token does not exist, so
 * the declaration is invalid and the gap is zero. A page of rows with no gaps
 * between them is the entire layout gone, and nothing anywhere reports it.
 * Every Obsidian variable this sheet reads therefore has to carry the value it
 * is meant to be as a fallback.
 */
import { readFileSync } from 'node:fs';

const SHEET = 'styles.css';
/** Variables the plugin defines itself, which need no fallback. */
const OWN = /^--cerebrum-|^--cb-/;
/**
 * Colours are a theme's to decide and have no sensible fixed value, so they are
 * read bare on purpose. Everything that contributes to layout is not.
 */
const COLOUR = /^--(text|background|interactive|color|accent|divider|scrollbar|graph)/;

// Comments explain this very mistake, so they must not be scanned for it.
const css = readFileSync(SHEET, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (block) =>
	block.replace(/[^\n]/g, ' '),
);
const problems = [];

const lines = css.split('\n');
lines.forEach((line, index) => {
	for (const match of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/g)) {
		const [, name, next] = match;
		if (OWN.test(name) || COLOUR.test(name) || next === ',') {
			continue;
		}
		problems.push(`${SHEET}:${index + 1}  ${name} is read with no fallback`);
	}
});

if (problems.length > 0) {
	console.error(`${problems.length} unguarded variable(s):\n${problems.join('\n')}`);
	process.exit(1);
}
console.log('styles: every sizing variable carries a fallback');
