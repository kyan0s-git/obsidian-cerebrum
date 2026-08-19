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

**Levels** come first when you have configured them — see
[folder levels](#folder-levels) below. Each one lists its values with counts,
and picking a value narrows the lists below it.

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
| Click | Opens the note, in the current tab or a new one per **Open notes in a new tab** |
| Cmd/Ctrl-click | Opens it the other way from your default |
| Middle click | Always opens a new tab |
| Cmd/Ctrl+Alt-click | Opens in a split, whatever the default |
| Cmd/Ctrl and hover | Page preview popover, if the Page preview core plugin is on |
| Right click | The full file menu, including entries other plugins add |
| Click a tag chip | Filters to that tag |

Results are paged at 60 items with a **Show more** button, so a large collection
does not build thousands of cards at once.

**Missing pages** uses a different row layout: the link text as written, how many
notes reference it, and chips for the referencing notes. Clicking the row opens
the link the same way clicking an unresolved link in a note does, which creates
the note; clicking a chip opens the note that asked for it.

## Levels

A vault encodes several independent things at once, and rarely in one place. A
path says `raw/2026/physics/unit-3`. A nested tag says `#status/active`. A
property says `type: reference`. All three are the same shape — a named
dimension with a small set of repeating values — and all three are stuck as long
as they can only be reached in the order the folder tree imposes. That is why
the top level alone is nondescript: `raw` and `wiki` are a *source*, orthogonal
to everything you actually browse by.

A **level** is that dimension, wherever it came from. Cerebrum reads three
sources:

| Source | Looks like | Configuration |
| --- | --- | --- |
| Nested tags | `#status/active` gives level `status`, value `active` | None |
| Frontmatter properties | `type: reference` gives level `type` | None |
| Folder paths | `raw/2026/physics/unit-3` | One pattern per tree |

Tags and properties name themselves, so Cerebrum finds them on its own: a vault
that uses nested tags or consistent properties gets working levels the moment
the plugin is enabled. Paths cannot name themselves, so they are the one source
that asks you for a pattern.

### Levels found automatically

Anything used like a category becomes a level: a tag namespace or a property
whose values repeat across at least three notes, with between two and forty
distinct values, and where values genuinely recur rather than being unique per
note.

That last rule is what keeps the rail clean. A `uid` property is unique per
note, so it is an identifier and never a level. A full timestamp is the same. A
one-off tag namespace used twice is not worth a section yet. Obsidian's own keys
— `title`, `aliases`, `tags`, `cssclasses` and friends — are never levels.

**Settings → Cerebrum → Levels found** lists exactly what was discovered, with
its source and how many notes carry it, so the automatic behaviour is never a
mystery. Anything unwanted goes in **Hidden levels**, and the whole mechanism
can be switched off with **Find levels automatically**.

### Levels from folder paths

Name the levels once and each becomes a filter of its own:

```
raw/<year>/<subject>/<unit>
wiki/<year>/<subject>/<unit>
```

Put those in **Settings → Cerebrum → Folder level patterns**, or press
**Detect folder levels** to have Cerebrum read your folders and suggest one
pattern per top level tree, which you then rename to taste.

### Using them

The rail grows a section per level. Picking **2026** narrows the
subject list to the subjects taught that year; picking **physics** narrows the
units to the ones that subject has. Every active filter appears as a chip above
the toolbar and can be removed on its own. The filters are independent of where
you are browsing, so *physics* alone gathers the subject across `raw/`, `wiki/`
and any other tree at once — the thing the folder hierarchy cannot do.

A note can sit in several values of one level at the same time, because tags and
list properties are naturally plural: a note tagged `#subject/physics` and
`#subject/maths` is counted and filtered under both.

**Group by** gains an entry per level, and cards show their level values instead
of a raw path. Clicking a value on a card filters to it.

### Patterns in detail

| Piece | Meaning |
| --- | --- |
| `<name>` | Captures this folder as the level `name` |
| a literal, like `raw` | Must match that folder name, case insensitively |
| `*` | Matches any one folder without capturing it |
| `**` | Ends the pattern explicitly; anything below is ignored |
| `#` at the start of a line | A comment |

Patterns are tried in order and the first one that matches wins.

### What happens when the vault does not fit

Paths are the source with edge cases, since a pattern makes a claim about shape.
Tags and properties have none: a note either carries one or it does not.

These are the cases worth knowing, all of which resolve without you doing
anything:

| Situation | What happens |
| --- | --- |
| A folder nested deeper than the pattern, say `unit-3/lab/` | The note keeps `unit-3`. Anything below the last named level stays with that level |
| A note higher up than the pattern, say `raw/2026/note.md` | It gets `year`, and simply has no `subject` or `unit`. Grouping puts it under "No subject" |
| A whole tree matching no pattern, say `inbox/` | It has no level values, and is still browsable under Spaces exactly as before |
| A new folder at a named level, say a new subject | It appears as a new value in that level's list on the next rebuild. Nothing to configure |
| A tree organised differently, say `archive/<subject>/<year>` | Give it its own pattern line. Different trees can name the same levels in a different order |
| One note filed in the wrong place | Add the level to its frontmatter — `subject: physics` — which overrides whatever the path says |
| A note that belongs somewhere it does not live | Same: frontmatter wins, so it can sit in `inbox/` and still file under a subject |

Level names are yours. Year, subject and unit suit a course; topic, project and
stage suit other work; a tag namespace or property is named by whatever you
already called it. Cerebrum treats only one name specially: a level whose values
look like years sorts newest first everywhere it appears.

When a path level and a property share a name, the property wins for that note —
the escape hatch for something filed where its path does not describe it. A tag
namespace of the same name adds its values instead of replacing them.

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
| Node colour | Its top level folder, or a level you chose, matching the legend |

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
- **Colour** picks what node colour means: the top level folder, or any level
  you have configured. Colouring by subject and then clicking a legend entry
  filters the graph to that subject.
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
- **Name your folder levels.** It is the single change that makes a large vault
  browsable: one click for every physics note of 2026, wherever it lives.
- **Give important notes a `description` in frontmatter.** It becomes the card
  excerpt, which turns the browser into something you can skim.
- **Check Missing pages regularly.** It is the list of notes you have promised
  yourself by linking to them, ordered by how many pages are waiting.
- **Check Orphans occasionally.** Anything there has fallen out of the web and
  is unlikely to be found again by following links.
- **Use the graph's local mode while writing.** With follow-the-active-note on,
  the graph is a live map of the neighbourhood you are working in.
