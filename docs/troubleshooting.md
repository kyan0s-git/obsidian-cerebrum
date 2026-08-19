# Troubleshooting

## The plugin does not appear in the plugin list

The folder name must be the plugin id and the files must sit directly inside it:

```
<YourVault>/.obsidian/plugins/cerebrum/main.js
<YourVault>/.obsidian/plugins/cerebrum/manifest.json
<YourVault>/.obsidian/plugins/cerebrum/styles.css
```

A nested folder from an unzipped archive (`cerebrum/cerebrum/main.js`) is the
usual cause. Press the refresh icon beside *Installed plugins* after fixing it.

If you built from source and there is no `main.js`, run `npm run build` — it is
gitignored and only exists after a build.

## A view is empty or looks stale

The index builds once the workspace is ready and then follows vault and metadata
events. If something looks out of date, run `Cerebrum: Rebuild the index` from
the command palette; it re-reads everything and clears the excerpt cache.

If a rebuild does not fix it, check **Hidden folders** in settings — a prefix
like `a` hides every path starting `a`, including `archive` and `apollo.md`.

## A folder I just created is missing

Folders appear on the next rebuild, which is debounced by 400 ms after the last
vault event. If it has been longer than that, the folder is either empty of
indexed files or excluded. Empty folders are indexed and shown; folders holding
only attachments show a count of zero because counts are notes only.

## Notes are missing from a space

**Include notes from subfolders** is off by default, so a space shows only what
sits directly in it, not what is nested below. Turn it on in settings, or click
into the subfolder from the rail or the folder cards.

Attachments are hidden by default too — turn on **Show attachments** to see PDFs
and images alongside notes.

## Card excerpts are blank

In order, check:

- **Show excerpts on cards** is on, and you are in card layout rather than list.
- The note is markdown. Canvas files and attachments have no excerpt.
- The file is under 512 KB. Larger files are skipped deliberately.
- The note has prose. A note that is only frontmatter, headings or code fences
  strips to nothing.

Giving a note a `description` in frontmatter always wins over reading the body.

## A level is missing, or a note is filed under the wrong one

**Settings → Cerebrum → Levels found** lists what was discovered and from where;
start there. If what you expect is not listed:

- **A tag or property is not becoming a level** — it needs at least three notes,
  at least two distinct values, and values that repeat. A property that is
  unique per note, like an id or a full timestamp, is deliberately excluded, as
  are Obsidian's own keys such as `title` and `aliases`.
- **A level you do not want keeps appearing** — add its name to **Hidden
  levels**, or turn off **Find levels automatically**.
- **No level sections at all and you organise by folders** — folders need a
  pattern. Press **Detect folder levels** to start from what you already have.
- **A whole tree has no levels** — no pattern matches it. Patterns are tried in
  order and literals must match the folder name, so `raw/<year>` will not match
  `Raw Notes/2026`. Add a line for that tree.
- **A note is missing the deepest level** — it lives higher up than the pattern
  reaches. That is expected; it groups under "No unit".
- **One note is wrong** — give it the level in its own frontmatter, for example
  `subject: physics`, which overrides the path.

For folder levels specifically, check the pattern for that tree under **Folder
level patterns**. All level settings rebuild the index, so they take effect as
soon as you stop typing.

## A link is not showing in the graph

- **The target is in a hidden folder.** Excluded paths cannot resolve, so the
  link is reported as a missing page instead.
- **The filter box is set, or a level chip is active.** Links to pages outside
  the filter are dropped on purpose, so a filtered graph shows only matching
  pages and links among them.
- **Local mode is on** at a depth that does not reach the target. Raise the
  depth or press the **x** to return to the whole vault.
- **Unlinked notes are turned off** and the note has no other links.
- **The node limit was reached** — the status line under the canvas says so when
  nodes were dropped. Raise it, or narrow the graph.

## The graph is a hairball, or drifts apart

Raise **repel strength** or **link distance** to spread it; lower repel strength
if clusters fly apart. Both reheat the layout without rebuilding it. See
[settings](settings.md#tuning-the-layout).

## The graph is slow

Lower the **node limit**, turn off **missing pages** and **unlinked notes**, or
use local mode. The layout stops on its own once it settles, so a static graph
uses no CPU — if you see constant load, something is reheating it: a plugin
touching files in the background will do that through the index rebuild.

## Hover preview does nothing

It needs the **Page preview** core plugin enabled, and Cerebrum registers with
`Mod` required by default — hold Cmd/Ctrl while hovering. **Settings → Core
plugins → Page preview** lists Cerebrum among its sources if you want to change
that.

## The graph's colours look wrong after switching theme

Colours are re-read when Obsidian fires `css-change`. A theme that changes
variables without triggering it can leave stale colours; reopen the graph tab.

## Settings reset themselves

Values are validated on load: anything of the wrong type falls back to its
default rather than being trusted. If you hand-edited `data.json`, check the
types against the reference in [settings](settings.md#what-the-file-looks-like) —
`recentDays` is a number; `excludedFolders`, `facetPatterns` and `hiddenFacets`
are arrays of strings.

## Reporting something else

Open an issue with your Obsidian version, your platform, the build string from
**Settings → Cerebrum → Build** (there is a copy button), and what the console
says — **Ctrl/Cmd + Shift + I**, Console
tab. If it involves specific notes, the shape of the links matters more than the
content: which of link, embed or frontmatter link, and whether the target
exists.
