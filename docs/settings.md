# Settings

**Settings → Community plugins → Cerebrum**. Everything is stored in
`<YourVault>/.obsidian/plugins/cerebrum/data.json`.

Some options live on a view's toolbar rather than in the settings tab, but they
are saved to the same file and survive a restart. The table below says where
each one is.

## Browsing

| Setting | Default | Where | Effect |
| --- | --- | --- | --- |
| Open notes in a new tab | off | Settings | Off, a click reuses the current tab. On, every click opens a new tab. Cmd/Ctrl always does the opposite, middle click always opens a tab, and Cmd/Ctrl+Alt always splits |
| Show excerpts on cards | on | Settings | Reads the first lines of a note for the card preview. Turning it off stops Cerebrum reading note bodies at all |
| Include notes from subfolders | off | Settings | Off, a space shows only what sits directly in it. On, it shows everything nested below |
| Show attachments | off | Settings | Includes images, audio, PDFs and other non-note files in the browser. Folder counts stay note-only either way |
| Recently edited window | 14 days | Settings | How far back the *Recently edited* collection reaches. 1–90 |
| Hidden folders | empty | Settings | One folder path per line. Everything inside is excluded from both views, from counts, and from link resolution, so a link into a hidden folder is reported as missing |
| Layout | cards | Browser toolbar | Cards or list |
| Sort key and direction | last modified, descending | Browser toolbar | Modified, created, title or link count |
| Grouping | none | Browser toolbar | None, folder, space, tag or date |

Hidden folders are matched by path prefix, so `archive` hides `archive` and
`archive/2019/notes.md` but not `archived-ideas`. Leading and trailing slashes
are ignored, and blank lines are dropped.

## Levels

| Setting | Default | Where | Effect |
| --- | --- | --- | --- |
| Find levels automatically | on | Settings | Discovers levels from nested tags (`#status/active`) and frontmatter properties used across several notes. Needs no configuration |
| Levels found | — | Settings | Read-only: what discovery found, with each level's source and note count |
| Hidden levels | empty | Settings | Level names to leave out of the views, one per line |
| Folder level patterns | empty | Settings | One pattern per line naming the folder levels, such as `raw/<year>/<subject>/<unit>` |
| Detect folder levels | — | Settings | Reads your folders and replaces the patterns with one suggestion per top level tree |

Levels are covered in full in the [user guide](user-guide.md#levels): the three
sources, what discovery accepts and refuses, and what happens to notes that sit
deeper or shallower than a pattern. All four settings rebuild the index.

## Graph

| Setting | Default | Where | Effect |
| --- | --- | --- | --- |
| Include pages that do not exist yet | on | Settings and toolbar | Draws links to missing notes as hollow nodes |
| Include unlinked notes | on | Settings and toolbar | Keeps notes with no links. Off, the graph shows only the connected web |
| Local graph depth | 1 | Settings and toolbar | Link steps followed around the focused note, in both directions. 1–4 |
| Link distance | 90 | Settings | Resting length of a link in the layout. 30–250 |
| Repel strength | 900 | Settings | How hard nodes push apart. 100–3000 |
| Node limit | 2000 | Settings | Stops adding nodes past this count. 200–8000 |
| Include attachments | off | Toolbar | Adds attachment nodes, coloured by file type |
| Colour | folder | Toolbar | What node colour means: the top level folder, or one of your levels. Appears only when levels are configured |
| Show link direction | on | Toolbar | Arrowheads on links |
| Show labels | on | Toolbar | Note titles under nodes |

### Tuning the layout

- A graph that looks like a hairball wants **more repel strength**, or a
  **longer link distance**, or both.
- A graph that drifts apart into islands wants **less repel strength**.
- Changing either setting reheats the simulation, so the graph re-settles
  without being rebuilt.

### Not in the interface

`graphCenterStrength` (default `0.05`) controls the pull towards the middle that
keeps disconnected clusters from drifting off screen. It has no control in the
settings tab; edit `data.json` while the plugin is disabled if you want to change
it. Values much above `0.2` compress the whole graph into the centre.

## What the file looks like

`data.json` after a first save, with defaults:

```json
{
  "openInNewTab": false,
  "viewMode": "cards",
  "sortKey": "modified",
  "sortDescending": true,
  "groupKey": "none",
  "showExcerpts": true,
  "showAttachments": false,
  "showSubfolderContents": false,
  "recentDays": 14,
  "excludedFolders": [],
  "facetPatterns": [],
  "autoFacets": true,
  "hiddenFacets": [],
  "graphIncludeAttachments": false,
  "graphIncludeUnresolved": true,
  "graphIncludeOrphans": true,
  "graphShowArrows": true,
  "graphShowLabels": true,
  "graphLocalDepth": 1,
  "graphLinkDistance": 90,
  "graphRepelStrength": 900,
  "graphCenterStrength": 0.05,
  "graphMaxNodes": 2000,
  "graphColorBy": ""
}
```

Stored values are merged over the defaults on load and checked as they go: a
value of the wrong type, or a key Cerebrum does not recognise, is ignored rather
than accepted. Deleting `data.json` resets everything.

## Which changes rebuild the index

Most settings only affect what is drawn. These change what is indexed and
rebuild it when you change them: **Show attachments**, **Hidden folders**, and
everything under **Levels**. That rebuild also clears the excerpt cache.

## Build

The bottom of the settings tab shows the exact build in use, such as
`1.0.0+0819.7e3366f`, with a button to copy it for a bug report. The part after
the `+` is SemVer build metadata: the build date as MMDD, and the commit the
build came from. It never appears in `manifest.json` or in a release tag, both
of which stay a plain `x.y.z`, because that is what Obsidian compares.
