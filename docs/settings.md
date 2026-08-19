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

## Folder levels

| Setting | Default | Where | Effect |
| --- | --- | --- | --- |
| Level patterns | empty | Settings | One pattern per line naming the folder levels, such as `raw/<year>/<subject>/<unit>`. Each named level becomes a filter in the rail, a grouping option, and a chip on cards |
| Detect levels from the vault | — | Settings | Reads your folders and replaces the patterns with one suggestion per top level tree |

Patterns are covered in full in the
[user guide](user-guide.md#folder-levels), including what happens to notes that
sit deeper or shallower than the pattern and how frontmatter overrides a level.
Changing the patterns rebuilds the index.

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

Most settings only affect what is drawn. Three change what is indexed, and
rebuild it when you change them: **Show attachments**, **Hidden folders** and
**Level patterns**. That rebuild also clears the excerpt cache.
