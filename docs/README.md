# Cerebrum documentation

Cerebrum is an Obsidian plugin that gives a vault two views it does not have out
of the box: a content browser that shows notes as readable cards, and a link
graph drawn from what each page actually links to.

| Page | What it covers |
| --- | --- |
| [Installation](installation.md) | Getting the plugin into a vault, from a release or from source |
| [User guide](user-guide.md) | The browser, the graph, commands, and every interaction |
| [Settings](settings.md) | Every setting, its default, and what it changes |
| [Architecture](architecture.md) | How the index, graph, layout and rendering fit together |
| [Contributing](contributing.md) | Development workflow, conventions, linting, releases |
| [Troubleshooting](troubleshooting.md) | What to check when something looks wrong |

## The short version

Open the browser from the ribbon (**Browse the vault**) to see your notes as
notes read as a course: levels to walk, tags to cross them. Open the graph
(**Open the link graph**) to see the link structure, including embeds,
frontmatter links and pages you have linked but never written.

Neither view is configured with your folder layout. Folders are read from the
vault as the views draw, so a folder added anywhere shows up immediately and
keeps a stable colour. Levels go further: nested tags and frontmatter
properties become filters on their own, and one pattern
(`raw/<year>/<subject>/<unit>`) does the same for folders.

## Design principles

These are the rules the code follows; they explain most of the behaviour you
will meet in the other pages.

1. **No assumed layout.** No folder name is special. Spaces are whatever the
   vault contains right now, discovered on every rebuild.
2. **Structure is data, not just a location.** A tag namespace, a property and a
   folder level are the same thing — a named dimension — and each becomes a
   filter in its own right, so a subject can be pulled out of every tree at once
   instead of being walked to in a fixed order.
3. **Links come from the page.** The graph reads each note's own references
   rather than a flattened link table, so a link, an embed and a frontmatter
   link stay distinguishable and keep their direction.
4. **Read only.** The plugin writes nothing but its own settings file. It makes
   no network requests and never touches a note's content.
5. **Idle means idle.** The graph layout stops once it settles, the index
   rebuilds on a debounce, and excerpts are read only for cards on screen.
