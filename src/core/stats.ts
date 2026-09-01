/**
 * What a vault amounts to, counted.
 *
 * A second brain is worth keeping only if it is actually growing, and the one
 * screen you see every time you open the browser is the honest place to say so.
 * Everything here is read off the index that is already built, so the dashboard
 * costs a pass over the notes and nothing else.
 */

import type { CerebrumSettings } from '../settings';
import type { NoteEntry } from '../types';
import type { VaultModel } from './vault-model';

/** How far back "recently" reaches. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One level and how many distinct values it has: the shape of the vault. */
export interface ShapeEntry {
	name: string;
	values: number;
}

export interface VaultStats {
	notes: number;
	attachments: number;
	/** Resolved outgoing references, counted once per note per target. */
	links: number;
	tags: number;
	updatedThisWeek: number;
	orphans: number;
	unresolved: number;
	/** Notes reachable from at least one other note. */
	connected: number;
	shape: ShapeEntry[];
}

export function vaultStats(
	model: VaultModel,
	settings: CerebrumSettings,
	now = Date.now(),
): VaultStats {
	const all = model.getAllNotes();
	const notes = all.filter((note) => note.isNote);
	const scope: NoteEntry[] = settings.showAttachments ? all : notes;

	let links = 0;
	let connected = 0;
	let updatedThisWeek = 0;
	for (const note of scope) {
		for (const link of note.outgoing) {
			if (link.resolved) {
				links++;
			}
		}
		if (note.incoming.length > 0) {
			connected++;
		}
		if (now - note.modified <= WEEK_MS) {
			updatedThisWeek++;
		}
	}

	const shape: ShapeEntry[] = [];
	for (const name of model.getFacetNames()) {
		const values = new Set<string>();
		for (const note of scope) {
			for (const value of note.facets[name] ?? []) {
				values.add(value);
			}
		}
		if (values.size > 0) {
			shape.push({ name, values: values.size });
		}
	}

	return {
		notes: notes.length,
		attachments: all.length - notes.length,
		links,
		tags: model.getTags().length,
		updatedThisWeek,
		orphans: model.getOrphans().length,
		unresolved: model.getUnresolved().length,
		connected,
		shape,
	};
}

/**
 * A count at a glance. Four digits is the most a stat tile can be read at speed,
 * so past that it is rounded and given its scale.
 */
export function compactNumber(value: number): string {
	if (value < 10_000) {
		return value.toLocaleString();
	}
	if (value < 1_000_000) {
		return `${trim(value / 1000)}K`;
	}
	return `${trim(value / 1_000_000)}M`;
}

function trim(value: number): string {
	return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
}
