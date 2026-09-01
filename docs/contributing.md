# Contributing

## Setup

Node 20 or later (CI runs 20, 22 and 24).

```bash
npm install
npm run dev     # watch build into main.js
npm run build   # typecheck, then a minified production bundle
npm run lint    # Obsidian's own ESLint plugin
```

The fastest loop is a clone inside a test vault's plugins folder with
`npm run dev` running — see [installation](installation.md#developing-against-a-live-vault).

## Before you push

```bash
npm run build && npm run lint
```

CI runs exactly this on every branch. `npm run build` typechecks with
`tsc -noEmit` before bundling, so a type error fails the build rather than
shipping.

## Linting

`eslint-plugin-obsidianmd` encodes Obsidian's review guidelines, and the config
also turns on `typescript-eslint`'s type-checked rules. The ones that shape this
codebase most:

| Rule | What it means here |
| --- | --- |
| `no-static-styles-assignment` | No `el.style.x = …`. Use a class, or `setCssProps` for values only known at runtime |
| `prefer-create-el` | Build DOM with `createDiv`, `createEl`, `createSpan` — never `document.createElement` or `innerHTML` |
| `no-view-references-in-plugin` | Never store a view on the plugin; look leaves up when you need them |
| `detach-leaves` | Do not detach leaves in `onunload`; Obsidian handles that |
| `no-unsupported-api` | Every API used must exist in `manifest.json`'s `minAppVersion` (currently 1.7.2) |
| `prefer-window-timers` | `window.setTimeout`, not bare `setTimeout` |
| `ui/sentence-case` | UI strings are sentence case: "Show link direction", not "Show Link Direction" |
| `validate-manifest` | `description` must be 10–250 plain-ASCII characters, start with a capital, end with a period, and avoid the words "obsidian" and "plugin" |

The suite currently reports **one warning**:
`settings-tab/prefer-setting-definitions` asks for `getSettingDefinitions()`,
Obsidian 1.13's declarative settings API. The installed `obsidian` package
(1.12.3) has no type definitions for it, and `minAppVersion` is 1.7.2, which
makes `display()` required regardless. Revisit when the typings ship.

Do not silence obsidianmd rules inline — the config bans it, and a rule firing
usually means the code would be rejected in community plugin review.

## Conventions

- **`main.ts` stays small.** It registers views, commands, the ribbon and
  events, and delegates everything else.
- **One responsibility per module**, roughly 200–300 lines. Split a file rather
  than letting it sprawl.
- **Every Obsidian variable that affects layout carries a fallback**:
  `var(--size-4-3, 12px)`. A token that does not exist makes the whole
  declaration invalid, so a missing `gap` is zero rather than close — the one
  CSS mistake that does not degrade gracefully. `npm run lint` fails on a bare
  one; the spacing scale itself lives in the `--cb-*` variables at the top of
  `styles.css`.
- **Rules for form controls are element-qualified**: `select.cerebrum-select`,
  not `.cerebrum-select`. Obsidian styles its controls with attribute selectors
  — `input[type=search]` is (0,1,1) and a bare class is (0,1,0), so the class
  loses and the app's own padding silently stays. `npm run lint` fails on a
  class applied to an `<input>` that is not element-qualified.
- **Tabs for indentation**, single quotes, trailing commas — match
  `.editorconfig` and the code around you.
- **Comment the why.** The code says what it does; comments should explain a
  decision that is not obvious, like why graph edges are restricted to the
  scope.
- **No new runtime dependencies.** Everything bundles into `main.js`; a
  dependency is a permanent cost to every user.
- **Nothing vault-layout specific.** No folder name is ever special-cased. If a
  feature needs to know about a folder, it discovers it from the vault.

## Testing

There is no test runner in the repository. The logic layer — `core/`, the
simulation and the renderer — is written to be testable outside Obsidian:
`link-graph.ts`, `filters.ts`, `graph-simulation.ts` and `graph-renderer.ts` have
no Obsidian imports beyond types, and `vault-model.ts` takes an `App` it only
reads through documented APIs.

That makes a headless harness practical: bundle a test entry point with esbuild,
alias `obsidian` to a stub exporting `TFile`, `TFolder`, `getAllTags`,
`getLinkpath`, `getFrontMatterInfo` and `prepareFuzzySearch`, hand `VaultModel` a
fake `App` over a synthetic vault, and assert on the index and graph it produces.
The render functions can be driven the same way with a small element shim,
because they only use `createDiv`/`createEl`/`setText`/`addEventListener`, and
`drawGraph` only needs an object recording canvas calls.

If you add such a harness to the repository, keep it out of the ESLint project
or expect the stub's `any` types to be reported.

Beyond that, test in a real vault. Worth exercising: a vault with no folders, a
folder created while a view is open, a note with a frontmatter link, a link to a
note that does not exist, a hidden folder that is the target of a link, and both
a light and a dark theme.

## Versioning

Releases are plain SemVer: `x.y.z` in `manifest.json`, in `versions.json`, and
as the git tag. Nothing else, because Obsidian matches a release tag against the
manifest version literally.

Builds additionally carry SemVer **build metadata**: `1.0.0+0819.7e3366f`, being
the build date as MMDD and the commit. `esbuild.config.mjs` computes it and
injects it through `define`; the plugin shows it under **Settings → Cerebrum →
Build**, and the release is titled with it. Build metadata is excluded from
precedence by the SemVer spec, which is exactly why it belongs on the artifact
and not in the manifest or the tag.

A development build stamps `x.y.z+dev`, so a build from a watch session is never
mistaken for a release.

## Releasing

1. Update `version` in `manifest.json` and add it to `versions.json` mapped to
   its minimum app version. `npm version patch|minor|major` does both plus
   `package.json`.
2. Raise `minAppVersion` if you have started using a newer API.
3. Commit and push to the default branch.
4. Release, either way round:

   **From the Actions tab** — run **Release Obsidian plugin** with
   `workflow_dispatch`. It builds, lints, checks the build carries its stamp,
   creates the tag, and publishes the release. Leave *version* blank to use the
   manifest, and tick *draft* if you want to review it first.

   ```bash
   gh workflow run release.yml -f draft=false
   ```

   **By pushing a tag** — `git tag -a 1.0.1 -m "Cerebrum 1.0.1" && git push
   origin 1.0.1`. Same workflow, except a tag push always produces a **draft**
   for you to review and publish.

Either path attests build provenance and attaches `main.js`, `manifest.json` and
`styles.css`. The workflow refuses, loudly, to produce a release that would not
mean what it says:

- a version that is not a plain `x.y.z`, which Obsidian will not install;
- a version that does not match `manifest.json`;
- a tag that already exists on a different commit, which would put code behind a
  version that never contained it;
- a version that already has a release, because replacing a published artifact
  silently changes what that version means. Bump instead.

`main.js` is gitignored on purpose: it is a release artifact, not source.
