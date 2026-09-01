# Cerebrum

A second brain is easier to think with when you can see it. Cerebrum replaces
tree digging with two views: a content browser that shows notes as cards you can
read at a glance, and a link graph that draws exactly what each page points at.

Neither view is told how your vault is organised. Folders are read from the vault
every time a view is drawn, so a new folder — top level, nested, next to `raw/`
and `wiki/` or nowhere near them — appears on its own, keeps a stable colour, and
needs no configuration.

## The browser

The vault reads as a course rather than a file tree. Home offers what you can
study; stepping in offers what is inside; the last step offers the notes.

- **One decision per screen.** Home is a shelf of tiles, a step in is a set of
  sections with their first few notes, the end is a plain list. Nothing else
  competes for the same glance.
- **A breadcrumb on every screen**, and the tab's own back arrow walks the trail
  in reverse, because each move is recorded in Obsidian's history.
- **No path says the same thing twice.** A level that leads only one way is
  walked in a single click and folded into one crumb; a child that repeats its
  parent's name drops it; the breadcrumb never ends with the heading below it.
- **The hierarchy is yours, and nothing needs configuring.** Nested tags
  (`#subject/physics`) and frontmatter properties (`type: reference`) are found
  automatically, and folder patterns are read off the folders themselves.
- **Trees of the same shape become one hierarchy.** If your sources, your own
  notes and your write-ups live in three parallel trees, they line up by the
  folder names they use rather than by depth — so a summary filed three folders
  deeper than its source still lands in the same unit, and a folder called
  `sources` never appears beside a unit it is not a sibling of.
- **Tags stay cross-cutting**, like a blog archive: every tag with its count,
  and a tag page listing its notes wherever they live.
- **Four devices borrowed from an encyclopaedia**, all read off your notes: the
  note named for its place leads that screen as *Start here*; *See also* lists
  the pages the notes here lean on that live elsewhere; *Categories* lists the
  tags they share; and **All notes** is an A–Z index rather than a long list.
- **Loose ends** collects what needs fixing rather than reading: pages you have
  linked but never written, and notes nothing links to.
- Search narrows to where you are. Sort and density are the only other controls.

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
