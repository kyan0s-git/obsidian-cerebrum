# Architecture

Cerebrum is a plugin lifecycle, one in-memory index, and two views that read it.
`main.ts` does nothing but wiring; every decision about what to show lives in a
module it delegates to.

```
src/
  main.ts                 lifecycle: views, commands, ribbon, event registration
  settings.ts             settings shape, defaults, safe merging of stored data
  build-info.ts           the build stamp injected at bundle time
  constants.ts            view types, icons, debounce and paging constants
  types.ts                the shared vocabulary: NoteEntry, FolderEntry, LinkRef
  core/
    vault-model.ts        the index of folders, notes, tags, links and backlinks
    facets.ts             levels: patterns, tag and property discovery, counting
    navigation.ts         the walk: where am I, what is inside, what is here
    link-graph.ts         nodes and edges, local graphs, ghosts, scope filtering
    filters.ts            fuzzy search and sorting
    excerpts.ts           lazy note previews with a modification-time cache
  ui/
    explorer-view.ts      the browser's ItemView, its trail, and history
    explorer-header.ts    breadcrumb, title and the two controls
    explorer-body.ts      tiles, sections, lessons, tags, loose ends
    graph-view.ts         the graph's ItemView: toolbar, canvas, interaction
    graph-renderer.ts     canvas drawing, camera transforms, hit testing
    graph-simulation.ts   the force layout and its Barnes-Hut quadtree
    settings-tab.ts       the settings interface
    file-actions.ts       opening notes, file menus, hover previews
    view-actions.ts       opening and reusing view tabs
  utils/
    format.ts             relative times, counts, path and tag formatting
    icons.ts              file extension to Lucide icon
    palette.ts            stable folder colours from a hash of the folder name
```

## Data flow

```mermaid
flowchart TD
    A[Vault and metadata cache] -->|create, modify, delete, rename, resolved| B[main.ts event handlers]
    B -->|debounced 400ms| C[VaultModel.rebuild]
    C --> D[Folders, notes, tags, links, backlinks, unresolved]
    D -->|notify subscribers| E[ExplorerView]
    D -->|notify subscribers| F[GraphView]
    E --> G[navigation.resolvePlace -> filters.ts -> screens]
    E -.->|on demand| H[ExcerptStore.cachedRead]
    F --> I[link-graph.buildGraph]
    I --> J[ForceSimulation.tick]
    J --> K[graph-renderer.drawGraph on canvas]
```

## The index

`VaultModel.rebuild()` runs in three passes and then notifies subscribers.

1. **Folders.** Walk `vault.getRoot()` recursively, recording each folder with
   its parent, depth and children. Excluded paths are skipped, along with
   everything below them. This is why folder discovery needs no configuration:
   the folder list *is* the vault's folder list, re-read every time.
2. **Files.** For each file from `vault.getFiles()`, build a `NoteEntry` from
   `metadataCache.getFileCache`: title (frontmatter `title` or the file name),
   summary (`description`, `summary` or `abstract`), tags via `getAllTags`,
   aliases, timestamps, facet values (see below), and whether it is a note
   (`.md` or `.canvas`) or an attachment. Note counts propagate up the folder
   chain; attachments are indexed but not counted.
3. **Links.** For each markdown note, collect `cache.links`, `cache.embeds` and
   `cache.frontmatterLinks`, resolve each through
   `metadataCache.getFirstLinkpathDest`, and record it as a `LinkRef` carrying
   its kind, its resolved state and its target. A resolved reference also
   appends the source path to the target's `incoming` list; an unresolved one is
   collected under the link text it was written as.

Rebuilds are full rather than incremental. Everything the pass reads is already
in Obsidian's memory, so the cost is proportional to file count and no disk I/O
is involved; a 400 ms debounce collapses bursts of events into one pass. Note
bodies are the exception — they are only read for excerpts, lazily, per card.

Attachments are always indexed, and the **Show attachments** setting filters at
the view layer instead. That keeps the graph's own attachment toggle independent
of the browser's.

## Levels

`facets.ts` turns structure into filters, from three sources: folder paths named
by a pattern, nested tag namespaces, and frontmatter properties. A note's values
are multi-valued per level, because tags and list properties are plural.

Tags and properties **name themselves**, so they are discovered rather than
configured. `discoverFacets` tallies every tag namespace and every non-reserved
frontmatter key across the vault and keeps the ones that behave like a category:
at least three notes, between two and forty distinct values, and values that
repeat rather than being unique per note. That last ratio is what excludes ids
and timestamps, which are the two things that would otherwise flood the hierarchy.
The result is capped, so a messy vault cannot produce twenty sections.

Two exclusions matter more than the thresholds. Dates are dropped by key and by
value shape, because a timestamp repeats across notes often enough to pass every
statistical test while being useless to browse by. And once every note has its
values, `dedupeFacets` compares levels pairwise: two that assign the same values
to the same notes are one dimension named twice, so the one the user named beats
one a pattern invented, and the values are recomputed without the loser.

Discovery has to see the whole vault before it can decide, which is why the
index runs it as a separate pass: files are indexed first, holding each note's
tags and frontmatter aside, then the levels are chosen, then every note's values
are filled in and the held material is dropped.

Path levels cannot name themselves, so they take a pattern. The matching rules
are deliberately forgiving, because a real vault is never uniform:

- **Deeper than the pattern**: extra segments are ignored, so a folder someone
  nests inside a unit does not knock its notes out of that unit.
- **Shallower than the pattern**: matching stops when the path runs out, and the
  levels never reached are simply absent rather than a failure.
- **A literal that does not match**: the rule fails and the next one is tried.
  A note matching no rule has no levels and stays browsable by folder.
- **Frontmatter**: a key named after a level overrides whatever the path says,
  which is the escape hatch for a note filed in the wrong place. A tag namespace
  of the same name adds to the values instead of replacing them.

Level *counts* are what let a screen say how much is behind each step.
`countValues` counts a facet's values under every active filter **except its
own**, which is what lets a year narrow the subject list while leaving all years
listed so you can switch in one click.

`detectRules` guesses patterns from the vault's own shape, one per top level
tree, naming a level `year` when most of its values look like years. It is
wired to a button rather than run automatically, so the guess lands in an
editable box instead of silently deciding the vault's structure.

### Reading a vault's shape

`detectRules` proposes the path patterns, and runs whenever no patterns are
written. It does not align trees by depth. It collects, for every tree and
every depth, the set of folder names used there, and clusters those sets by
overlap: the units are wherever `unit-1` appears, whether that is the third
segment of `raw/` or the fourth of `wiki/`. Clusters spanning several trees are
the hierarchy; a cluster only one tree has is that tree's own filing and
becomes a `kind`. The tree itself is emitted as a pinned segment,
`<shelf=raw>`, which matches one folder and records it as a level.

`patternNames` then decides the walk order: levels every rule declares, or whose
place no other rule contests, come first; the pin comes next; levels only some
rules declare come last. That is what keeps `sources` and `papers` behind the
shelf that tells them apart.

## The walk

`navigation.ts` turns the levels into a hierarchy to walk. Levels are already
ordered, so the first is what home offers, the second is what one of those
contains, and so on. A vault with no levels walks its folders instead, which is
why an unconfigured vault still browses as a course.

`resolvePlace` answers three questions for any trail: the crumbs back, the
children one step down with their counts, and the notes that sit at exactly
this point rather than inside a child. That last distinction is what keeps a
note filed above its unit visible instead of swallowed.

Every move goes through `leaf.setViewState(..., { history: true })` rather than
assigning to a field, so Obsidian records it and the tab's back arrow walks the
trail in reverse — the same history that moves between files.

`descend` is where a path stops repeating itself: from any point it walks on
while the next level offers exactly one way and nothing is filed here, so a
corridor of single-child levels costs one click rather than four. `resolvePlace`
marks each crumb `forced` when the step before it offered no alternative, which
is what lets the header fold those steps into one crumb, and `trimRepeat` drops
a parent's name from a child that already carries it.

The same module carries five functions that read the vault the way an
encyclopaedia reads: `overviewNote` picks the note that names the place it sits
in, `seeAlso` counts the links leaving a place to find what it leans on,
`placeCategories` takes the tags its notes share, and `alphabetIndex` files
every note under its initial, and `noteContext` says where a note sits in as
few words as tell it apart. All of them are derived, so nothing has to be kept
up to date by hand.

## Building the graph

`buildGraph` takes the index and a set of options and returns nodes and edges.

1. **Include** the notes that pass the attachment filter.
2. **Scope** them: in local mode, a breadth-first walk out from the focused note
   to the configured depth, following links in both directions; then any facet
   filters; then the query filter over path, title and tags.
3. **Build** nodes for the scope, then walk each scoped note's outgoing
   references. A reference to a note **outside the scope is skipped**, which is
   what keeps a depth of one at a depth of one and stops a filter from dragging
   neighbours back in. An unresolved reference becomes a ghost node keyed by
   `unresolved:<lowercased text>`, which cannot collide with a vault path.
4. **Finish**: mark reciprocal pairs as mutual, and drop unconnected nodes when
   unlinked notes are turned off.

The node limit is enforced while building; the count of what it dropped is
reported back so the view can say so.

Edges are deduplicated per source, target and kind — so a note linking to
another twice draws one line, but linking *and* embedding draws two, because
those are different relationships.

## Layout

`ForceSimulation` is a small force-directed layout over the node objects
themselves; positions live on the nodes, so a rebuild can carry them over and
the graph shifts rather than jumping.

Each tick applies, in order:

- **Repulsion** through a Barnes-Hut quadtree with θ = 0.9. Cells further away
  than their size allows are treated as a single mass at their centre of mass,
  which is what keeps a few thousand nodes cheap. Subdivision is capped at depth
  22 so coincident points cannot recurse forever.
- **Springs** along each edge, pulling towards the configured link distance.
- **Centering**, a weak pull towards the origin.
- **Integration**: velocities damped by 0.78 and clamped, then applied. Pinned
  nodes have their velocity zeroed and keep the position the drag gave them.

`alpha` starts at 1 and decays by 0.988 per tick; below 0.004 the simulation
reports itself settled and `GraphView` stops requesting frames. Dragging,
changing a force setting or rebuilding reheats it. Nodes are seeded on a
phyllotaxis spiral, which avoids the symmetric collapse a grid produces.

Smoothness is mostly restraint. Heavy damping and a low speed ceiling mean a
node covers a short distance each frame rather than a long one, and a node with
no position yet is seeded **beside something it links to** rather than on a
spiral across the graph, so it barely has to travel. Newly arrived nodes fade
and grow in over a few frames, the camera glides to a new framing instead of
cutting, and a dragged node eases towards the cursor so the web follows it
rather than snapping after it.

Measured on this implementation: 1,500 nodes and 1,499 edges tick in well under
16 ms, so the layout holds 60 fps while settling, and no node moves more than a
few pixels in a single frame.

## Rendering

`graph-renderer.ts` is pure drawing with no Obsidian dependency, which is what
makes it testable outside the app.

- The canvas is sized to `devicePixelRatio` and the context pre-scaled, so text
  and lines stay sharp on high-density screens.
- The camera is `{x, y, scale}`. `toScreen` and `toWorld` convert between
  spaces; zooming converts the cursor to world space before and after the scale
  change and shifts the camera by the difference, which is what makes the zoom
  track the pointer.
- Colours are read from the theme's own CSS variables (`--background-primary`,
  `--text-normal`, `--interactive-accent` and friends) and cached until
  Obsidian's `css-change` event fires, so the graph follows the active theme
  including light and dark switches.
- Edges are trimmed at both nodes' radii rather than drawn centre to centre,
  and every node is painted on a ring of the page colour, so lines never run
  under a node or touch its fill. Those two together are most of the difference
  between a graph that looks drawn and one that looks plotted.
- Hit testing is a linear scan for the nearest node within its radius plus a
  small screen-space margin. At the node counts the limit permits this is
  cheaper than maintaining a spatial index alongside a moving layout.

## Views and state

Both views are `ItemView`s registered in `onload`. Neither is ever stored on the
plugin: when the plugin needs to reach one — a theme change, a new active file —
it iterates `workspace.getLeavesOfType()` and checks `instanceof`, so no
reference can outlive its leaf.

Each view keeps its own state and reports it through `getState`/`setState`, so
the browser's selection and the graph's focus survive a workspace reload and
work with the back and forward arrows.

Render work is debounced by role: 40 ms for a full browser redraw, 120 ms for
results-only redraws while typing, 250 ms for a graph rebuild. The browser
splits header rendering from body rendering specifically so typing in the search
box never re-creates the input under the caret.

Subscriptions are handed out by `VaultModel.subscribe`, which returns its own
unsubscriber; each view calls it in `onClose` alongside disconnecting its resize
observer and cancelling its animation frame.

## The build stamp

`esbuild.config.mjs` computes `x.y.z+MMDD.sha` at bundle time and injects it
through `define`, so the artifact can say what it is. `build-info.ts` reads it
behind a `typeof` guard, which means a build without the define still loads and
simply reports `unknown` rather than throwing.

The metadata deliberately stops at the artifact. SemVer excludes build metadata
from precedence, and Obsidian compares `manifest.json`'s version against release
tags, so both stay a plain `x.y.z` and only the string the plugin reports about
itself carries the date and commit.

## Deliberate constraints

- **No dependencies.** Everything ships in `main.js` from `src/`; the only
  runtime import is `obsidian` itself, which the bundle marks external.
- **No `innerHTML`.** All DOM is built through Obsidian's `createEl` helpers.
- **No inline styles.** Dynamic values reach CSS through custom properties set
  with `setCssProps` (`--cerebrum-accent`, `--cerebrum-depth`); everything else
  is a class in `styles.css` built on Obsidian's variables.
- **No node references held across rebuilds** except positions, which are copied
  by id.

These are also what `eslint-plugin-obsidianmd` enforces; see
[contributing](contributing.md).
