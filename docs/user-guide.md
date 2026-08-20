# User guide

## Opening the views

| How | What it opens |
| --- | --- |
| Ribbon, grid icon | The browser |
| Ribbon, fork icon | The graph |
| Fork icon in the browser's tab header | The graph, filtered to what you are browsing |
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

The vault reads as a course. Home offers what you can study, a step in offers
what is inside it, and the last step offers the notes themselves. A breadcrumb
sits above every screen, and the tab's own back arrow walks the trail in
reverse, because each move is recorded the way Obsidian records opening a file.

### The screens

| Screen | Shows |
| --- | --- |
| **Home** | One tile per value of your first level — the subjects, or the top folders when you have no levels. Underneath, quiet links to all notes, tags and loose ends |
| **A step in** | Each value of the next level as a section, with the first few notes under it and a way into the rest — the way a course lists units with their lessons. Underneath: what this place links out to, and the tags it files under |
| **The last step** | A plain list of notes, in the order you chose |
| **All notes** | Every note under its initial, with the alphabet across the top |
| **Tags** | Every tag with its count, like a blog archive. A tag lists its notes wherever they live |
| **Loose ends** | Pages you have linked but never written, and notes nothing links to |

### Four things borrowed from an encyclopaedia

A vault has the same problem an encyclopaedia does: thousands of pages that only
mean anything next to each other. Wikipedia solves it with four devices, and
Cerebrum reads all four off your notes rather than asking you to write them.

| Device | In Cerebrum |
| --- | --- |
| A category's main article | A note named for the place it sits in — `physics/physics.md`, or an `index`, `overview` or `readme` — leads that screen as **Start here**, with the first lines of what it says. It is not repeated in the list below |
| See also | The pages the notes here lean on that live *somewhere else*, counted from the links themselves. It is the one way the hierarchy is crossed without searching |
| The category footer | **Categories**: the tags the notes here actually share. Tags used only once stay on their note, so the footer says something about the place rather than listing everything |
| Special:AllPages | **All notes** is an A–Z index rather than an endless list. Click a letter to jump |

None of this is configured, and none of it needs maintaining: rename a note and
it stops leading its place, link to a page and it appears under "See also".

Notes that sit above the level they are being browsed by are never hidden: they
appear under **Also here** at that step. A note that fits no level at all still
shows on home the same way, so nothing is unreachable.

### Getting around

- **A breadcrumb** on every screen, each part clickable.
- **Back and forward**, the tab's own arrows, because every move is recorded in
  the same history Obsidian keeps for files.
- **Search** narrows to where you are: inside a subject it searches that
  subject, on a flat screen it searches everything.
- **Sort** and **density** are the only other controls. Sort options carry their
  own direction; density decides whether a note gets a line of what it says.

There is no sidebar of simultaneous filters. The hierarchy *is* the navigation,
and tags cross it when the hierarchy is the wrong shape for what you want.

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

That last rule is what keeps the hierarchy shallow. A `uid` property is unique per
note, so it is an identifier and never a level. A full timestamp is the same. A
one-off tag namespace used twice is not worth a section yet. Obsidian's own keys
— `title`, `aliases`, `tags`, `cssclasses` and friends — are never levels.

Two things are deliberately never levels. **Dates** — a `created` or `updated`
property, or any value that looks like a date — because a point in time is not
a category to browse by, however much the values repeat. And **duplicates**: if
two levels put the same notes in the same places, they are one dimension named
twice, so only one survives. A folder pattern that invented the name `category`
loses to your own `class` property, because the name you wrote means something
and the one a pattern guessed does not.

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

Levels are the steps of the walk, in the order they are declared or discovered.
The first is what home offers, the second is what a course contains, and so on
down to the notes. Reordering the patterns reorders the walk.

A note can carry several values of one level — two subject tags, say — and it
then appears under each of them, which is what you want from a tag and what a
folder could never do.

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
| A note higher up than the pattern, say `raw/2026/note.md` | It gets `year`, and simply has no `subject` or `unit`. It is listed under **Also here** on the year's screen, rather than being lost inside a subject |
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
- **Display options** (the sliders icon) holds what to include — attachments,
  pages not written yet, notes with no links — and whether to draw arrows and
  labels. They change rarely, so they sit behind one control rather than five
  buttons you re-read every time.
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
