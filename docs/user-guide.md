# User guide

## Opening the views

| How | What it opens |
| --- | --- |
| Ribbon, grid icon | The browser |
| Ribbon, fork icon | The graph |
| Command palette | Five commands, listed below |
| Right click a note in any file list | **Show links in graph** |
| Right click a folder in the file explorer | **Browse this folder** |

Both views open as tabs in the main area and reuse an existing tab of the same
type rather than piling up duplicates.

### Commands

All appear in the palette prefixed with `Cerebrum:`. None ship with a hotkey;
bind them yourself in **Settings → Hotkeys**.

| Command | Notes |
| --- | --- |
| Browse the vault | Opens the browser |
| Open the link graph | Opens the graph for the whole vault |
| Show the active note in the link graph | Opens the graph centred on the current note |
| Show the space holding the active note | Opens the browser at the current note's folder |
| Rebuild the index | Forces a full re-read; useful if anything looks stale |

## The browser

Three regions: a breadcrumb and toolbar on top, a rail on the left, cards in the
middle.

### The rail

**Collections** are computed from the link structure, not the folder layout:

| Collection | Contains |
| --- | --- |
| All notes | Everything indexed |
| Recently edited | Notes modified inside the recent window (14 days by default) |
| Link hubs | Notes with incoming links, most linked first |
| Orphans | Notes with no links in and no resolved links out |
| Missing pages | Link targets that have no note behind them, with the pages referencing them |

**Spaces** are your folders. The rail lists the top level, and unfolds the
branch you are currently inside so you keep sight of the rest of the vault while
drilling down. The count beside a folder is the number of notes in it and
everything below it; attachments are not counted. A **Vault root** entry appears
above the folders when notes are stored loose at the root.

**Tags** lists the 24 most used tags with their counts. Clicking one filters to
notes carrying it.

### The toolbar

- **Search** matches titles, paths, tags and aliases using Obsidian's own fuzzy
  matcher, best matches first. In vaults over 3,000 notes it narrows to titles
  and paths to keep typing responsive.
- **Sort** by last modified, date created, title or link count, with a separate
  ascending/descending toggle.
- **Group** by folder, space, tag or date. Grouping by tag puts a note into
  every tag it carries.
- **Layout** switches between cards and a denser list. Excerpts appear on cards
  only.
- **Graph** (fork icon) opens the graph filtered to the current selection.

The breadcrumb above the toolbar shows where you are, and every segment except
the last is clickable.

### Cards

A card shows the title, the folder, an excerpt, up to four tags, the last edit,
and two counts: links in and links out.

- The **title** is the note's frontmatter `title` if it has one, otherwise the
  file name.
- The **excerpt** is the frontmatter `description`, `summary` or `abstract` if
  present. Otherwise the note is read and stripped down to prose — code fences,
  headings, list markers, embeds and link syntax removed — and clipped to about
  220 characters. Files above 512 KB are never read for an excerpt.

| Action on a card | Result |
| --- | --- |
| Click | Opens the note in the current tab |
| Cmd/Ctrl-click, or middle click | Opens it in a new tab |
| Cmd/Ctrl and hover | Page preview popover, if the Page preview core plugin is on |
| Right click | The full file menu, including entries other plugins add |
| Click a tag chip | Filters to that tag |

Results are paged at 60 items with a **Show more** button, so a large collection
does not build thousands of cards at once.

**Missing pages** uses a different row layout: the link text as written, how many
notes reference it, and chips for the referencing notes. Clicking the row opens
the link the same way clicking an unresolved link in a note does, which creates
the note; clicking a chip opens the note that asked for it.

## The graph

### Reading it

| Element | Meaning |
| --- | --- |
| Solid line | An inline `[[link]]` |
| Dashed line | An embed, `![[…]]` |
| Dotted line | A link written in frontmatter |
| Arrowhead | Points from the page that wrote the link to its target |
| Filled node | A note |
| Hollow node | A page that does not exist yet |
| Node size | Grows with the number of links touching the page |
| Node colour | Its top level folder, matching the legend |

Hovering a node highlights it and everything it links to or from, and dims the
rest. The status line under the canvas reports node and link counts, and says so
when the node limit hid part of the vault.

### The toolbar

- **Filter** narrows the graph to pages whose path, title or tags match. Links
  to pages outside the filter are dropped rather than pulling those pages back
  in, so what you see is exactly the matching set and the links among them.
- **Follow the active note** switches to local graph mode: the graph re-centres
  on whatever note you open, out to the depth chosen beside it (1–4 steps,
  following links in both directions). The **x** button returns to the whole
  vault.
- Toggles for **attachments**, **missing pages**, **unlinked notes**, **arrows**
  and **labels**. All are remembered between sessions.
- **Fit to view** frames every node; **run the layout again** unpins everything
  and reshuffles.

The legend in the corner lists the ten largest spaces in the current graph.
Clicking one filters to it; clicking it again clears the filter.

### Mouse and gestures

| Action | Result |
| --- | --- |
| Click a node | Opens the note. A hollow node creates it first |
| Cmd/Ctrl-click | Opens in a new tab |
| Drag a node | Moves it and pins it there |
| Drag the background | Pans |
| Scroll | Zooms towards the cursor |
| Double click a node | Re-centres the graph around that note |
| Right click a node | The full file menu |

Labels appear once you zoom past roughly 75%, and always for the node you are
hovering or focused on. Arrowheads appear past roughly 45%.

### Performance

The layout is a force simulation that stops as soon as it settles, so a graph
left open costs nothing. Rebuilds keep the positions of nodes that survive, so
editing a note nudges the graph rather than reshuffling it.

The **node limit** (2,000 by default) caps how many nodes are built. On a vault
larger than that, either raise it, turn off unlinked notes and missing pages, or
use the filter and local graph mode to look at one region at a time.

## Working with a second brain

A few habits make the views considerably more useful:

- **Hide the folders you never browse** — templates, attachment dumps, archived
  dailies. They drop out of both views and out of link resolution.
- **Give important notes a `description` in frontmatter.** It becomes the card
  excerpt, which turns the browser into something you can skim.
- **Check Missing pages regularly.** It is the list of notes you have promised
  yourself by linking to them, ordered by how many pages are waiting.
- **Check Orphans occasionally.** Anything there has fallen out of the web and
  is unlikely to be found again by following links.
- **Use the graph's local mode while writing.** With follow-the-active-note on,
  the graph is a live map of the neighbourhood you are working in.
