# Cerebrum

A second brain is easier to think with when you can see it. Cerebrum replaces
tree digging with two views: a content browser that shows notes as cards you can
read at a glance, and a link graph that draws exactly what each page points at.

Neither view is told how your vault is organised. Folders are read from the vault
every time a view is drawn, so a new folder — top level, nested, next to `raw/`
and `wiki/` or nowhere near them — appears on its own, keeps a stable colour, and
needs no configuration.

## The browser

Open it from the ribbon (**Browse the vault**) or the command palette.

- **Spaces** — every folder in the vault, discovered at runtime. The rail lists
  the top level, then unfolds the branch you are browsing so you never lose the
  rest of the vault while drilling down.
- **Vault** — the three views a sort cannot produce: all notes, orphans
  (nothing in, nothing out), and missing pages (links written for notes that do
  not exist yet, with the pages asking for them).
- **Levels** — the dimensions your vault already has, turned into filters.
  Nested tags (`#status/active`) and frontmatter properties (`type: reference`)
  are found automatically, with no configuration at all; folder levels take one
  pattern, `raw/<year>/<subject>/<unit>`. Either way each level becomes a filter
  of its own: one click for every physics note of 2026, across `raw/`, `wiki/`
  and anywhere else it lives. Levels narrow each other as you pick them, group
  the results, and label the cards.
- **Tags** — every tag in the vault with its note count, as a one-click filter.
- **Cards** carry a title, two lines of what the note says, and the least
  context that tells it apart — a level you already filtered by is left off,
  and link counts wait until hover. One density control switches between a card
  and a row.
- Search runs over titles, paths, tags and aliases with Obsidian's own fuzzy
  matcher. Beside it sit one sort control, whose options carry their own
  direction, and one grouping control. That is the whole toolbar.

## The graph

Open it from the ribbon (**Open the link graph**), the command palette, or the
right-click menu of any note.

The graph is built from each page's own references rather than a summarised link
table, so it shows what is actually written:

- **Inline links, embeds and frontmatter links** are all drawn, each with its own
  line style, in the direction they were written.
- **Links to pages that do not exist yet** become hollow ghost nodes — clicking
  one creates and opens the note.
- **Node size** follows how many links touch a page; **node colour** follows its
  top level folder or any level you configured, with a legend that filters the
  graph as you click it.
- **Local graph mode** follows the active note at a depth you choose, and the
  filter narrows the graph to matching paths, titles or tags.
- Drag to pin, scroll to zoom, double click to re-centre. The Barnes-Hut force
  layout stops as soon as it settles, so an idle graph costs nothing.

## Install

Copy `main.js`, `manifest.json` and `styles.css` from a release into
`<YourVault>/.obsidian/plugins/cerebrum/`, then enable **Cerebrum** in
**Settings → Community plugins**. Requires Obsidian 1.7.2 or later.

Full instructions, including building from source and developing against a live
vault, are in [docs/installation.md](docs/installation.md).

## Documentation

| Page | What it covers |
| --- | --- |
| [Installation](docs/installation.md) | Release install, source build, dev setup |
| [User guide](docs/user-guide.md) | Both views, commands, every interaction |
| [Settings](docs/settings.md) | Every setting, default and effect |
| [Architecture](docs/architecture.md) | Index, graph building, layout, rendering |
| [Contributing](docs/contributing.md) | Workflow, conventions, linting, releases |
| [Troubleshooting](docs/troubleshooting.md) | What to check when something looks wrong |

## Everything stays local

Cerebrum reads the vault through Obsidian's own APIs and writes nothing except
its settings. There are no network requests, no telemetry, and no files touched
outside the ones you open yourself.

## Development

```bash
npm install
npm run dev     # watch build into main.js
npm run build   # typecheck, then a production bundle
npm run lint    # Obsidian's own ESLint plugin
```

## Licence

Zero-clause BSD. See [LICENSE](LICENSE).
