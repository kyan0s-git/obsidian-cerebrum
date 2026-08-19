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

## Releasing

1. Update `version` in `manifest.json` (semver, no `v` prefix) and add the
   version to `versions.json` mapped to its minimum app version. `npm version
   patch|minor|major` does both plus `package.json`.
2. Raise `minAppVersion` if you have started using a newer API.
3. Commit, then tag and push:

   ```bash
   git tag -a 1.0.1 -m "Cerebrum 1.0.1"
   git push origin 1.0.1
   ```

4. `.github/workflows/release.yml` builds the tag, attests build provenance, and
   opens a **draft** release with `main.js`, `manifest.json` and `styles.css`
   attached. Review it and publish.

The tag must match `manifest.json`'s version exactly. `main.js` is gitignored on
purpose: it is a release artifact, not source.
