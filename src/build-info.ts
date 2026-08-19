/**
 * The build stamp, injected at bundle time by `esbuild.config.mjs`.
 *
 * SemVer keeps build metadata after a `+`, where it is explicitly *not* part of
 * version precedence. That is exactly right here: Obsidian compares
 * `manifest.json`'s version against release tags, so the tag and the manifest
 * stay a plain `x.y.z`, and the date and commit ride along only in the string
 * the build reports about itself.
 */
declare const __CEREBRUM_BUILD__: string | undefined;

/** Full version with build metadata, such as `1.0.0+0819.7e3366f`. */
export const BUILD_VERSION: string =
	typeof __CEREBRUM_BUILD__ === 'string' ? __CEREBRUM_BUILD__ : 'unknown';

/** Just the release version, without the build metadata. */
export const VERSION: string = BUILD_VERSION.split('+')[0] ?? 'unknown';
