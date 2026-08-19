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
- **Collections** — computed from the link structure rather than the folder
  layout: all notes, recently edited, link hubs (what the vault points at most),
  orphans (nothing in, nothing out), and missing pages (links written for notes
  that do not exist yet, with the pages asking for them).
- **Tags** — every tag in the vault with its note count, as a one-click filter.
- **Cards** show the title (frontmatter `title` wins), the folder, an excerpt
  pulled from the note itself (or its `description`/`summary` frontmatter), tags,
  the last edit, and how many links point in and out. A list layout is a click
  away when you want density instead.
- Search runs over titles, paths, tags and aliases with Obsidian's own fuzzy
  matcher. Sorting and grouping (by folder, space, tag or date) sit next to it.
- Click opens, `Ctrl`/`Cmd`-click opens a tab, middle click opens a tab, right
  click gives the normal file menu with everything your other plugins add to it.

## The graph

Open it from the ribbon (**Open the link graph**), the command palette, or the
right-click menu of any note.

The graph is built from each page's own references rather than a summarised link
table, so it shows what is actually written:

- **Inline links, embeds and frontmatter links** are all drawn, each with its own
  line style, in the direction they were written. Mutual links are marked.
- **Links to pages that do not exist yet** become hollow ghost nodes — clicking
  one creates and opens the note the way any other unresolved link does.
- **Node size** follows how many links touch a page; **node colour** follows its
  top level folder, with a legend that updates as the vault changes.
- **Local graph mode** follows the active note at a depth you choose, and the
  filter box narrows the graph to matching paths, titles or tags — links to
  pages outside the filter are left out rather than dragging them back in.
- Drag to pin a node, drag the background to pan, scroll to zoom, double click to
  re-centre the graph on a page. Layout is a Barnes-Hut force simulation that
  stops as soon as it settles, so an idle graph costs nothing.

## Settings

**Settings → Community plugins → Cerebrum** covers excerpts, whether spaces
include nested notes, attachments, the recent window, hidden folders, and the
graph's node limit and force strengths.

Hidden folders are matched by path prefix, one per line, and apply to both views.

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

Source layout:

```
src/
  main.ts                 plugin lifecycle: views, commands, events
  settings.ts             settings shape, defaults and safe merging
  constants.ts, types.ts
  core/
    vault-model.ts        the index: folders, notes, tags, links, backlinks
    link-graph.ts         nodes and edges, local graphs, ghosts, filters
    filters.ts            search, sorting, grouping
    excerpts.ts           lazy note previews
  ui/
    explorer-*.ts         the content browser
    graph-*.ts            the graph view, renderer and force simulation
    settings-tab.ts, file-actions.ts, view-actions.ts, collections.ts
  utils/                  formatting, icons, folder palette
```

To test a build by hand, copy `main.js`, `manifest.json` and `styles.css` into
`<Vault>/.obsidian/plugins/cerebrum/` and reload Obsidian.

## Licence

Zero-clause BSD. See [LICENSE](LICENSE).
