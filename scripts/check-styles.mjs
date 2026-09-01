/*
 * Guards the stylesheet against the one CSS mistake that does not degrade.
 *
 * `gap: var(--size-4-7)` is not a few pixels out — the token does not exist, so
 * the declaration is invalid and the gap is zero. A page of rows with no gaps
 * between them is the entire layout gone, and nothing anywhere reports it.
 * Every Obsidian variable this sheet reads therefore has to carry the value it
 * is meant to be as a fallback.
 */
import { readFileSync, readdirSync } from 'node:fs';

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

/*
 * The second silent cascade loss: Obsidian styles its form controls with
 * attribute selectors — `input[type=search] { padding-left: 30px }` is (0,1,1),
 * and a rule of ours written as a bare class is (0,1,0). It loses, and the
 * app's padding stays where it was with nothing to show for it. Any class we
 * put on an <input> therefore has to be styled element-qualified.
 */
const INPUT_CLASSES = /createEl\(\s*'input'[\s\S]{0,200}?cls:\s*'([^']+)'/g;
const sources = readdirSync('src/ui').filter((name) => name.endsWith('.ts'));
for (const name of sources) {
	const code = readFileSync(`src/ui/${name}`, 'utf8');
	for (const match of code.matchAll(INPUT_CLASSES)) {
		for (const cls of (match[1] ?? '').split(/\s+/).filter(Boolean)) {
			if (!css.includes(`.${cls}`)) {
				continue;
			}
			const qualified = new RegExp(`[a-z\\]]\\.${cls}\\b`).test(css);
			if (!qualified) {
				problems.push(
					`styles.css  .${cls} styles an <input> but is not element-qualified, ` +
						`so Obsidian's input[type=...] rules outrank it`,
				);
			}
		}
	}
}

if (problems.length > 0) {
	const unique = [...new Set(problems)];
	console.error(
		`${unique.length} stylesheet problem(s):\n${unique.join('\n')}`,
	);
	process.exit(1);
}
console.log('styles: fallbacks present, control rules win the cascade');
