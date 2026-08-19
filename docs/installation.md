# Installation

Cerebrum needs Obsidian **1.7.2** or later. It runs on desktop and mobile;
nothing in it is desktop only.

## From a release

1. Download `main.js`, `manifest.json` and `styles.css` from the release.
2. Create the folder `<YourVault>/.obsidian/plugins/cerebrum/` and put all three
   files in it. The folder name must match the plugin id, `cerebrum`.
3. In Obsidian, open **Settings → Community plugins**. Turn off Restricted mode
   if it is on, press the refresh icon beside *Installed plugins*, and enable
   **Cerebrum**.

No restart is needed. Two icons appear in the left ribbon.

The resulting layout:

```
<YourVault>/.obsidian/plugins/cerebrum/
    main.js        the bundled plugin
    manifest.json  id, version, minimum app version
    styles.css     the plugin's stylesheet
    data.json      created on first save, holds your settings
```

## From source

`main.js` is a build artifact and is deliberately not committed, so a clone has
to be built before it can be installed.

```bash
git clone https://github.com/kyan0s-git/obsidian-cerebrum
cd obsidian-cerebrum
npm install
npm run build
```

Then copy `main.js`, `manifest.json` and `styles.css` into the plugin folder as
above, and enable the plugin.

## Developing against a live vault

Clone the repository directly into the plugins folder and let esbuild watch it:

```bash
cd <YourVault>/.obsidian/plugins
git clone https://github.com/kyan0s-git/obsidian-cerebrum cerebrum
cd cerebrum
npm install
npm run dev
```

`npm run dev` rebuilds `main.js` on every save. Reload the plugin to pick up a
change — the [Hot reload](https://github.com/pjeby/hot-reload) plugin does this
automatically, otherwise toggle Cerebrum off and on in **Settings → Community
plugins**.

Because the clone lives inside the vault, keep `.obsidian/plugins/cerebrum/`
out of any vault sync you run, or you will sync `node_modules` with it.

## Upgrading

Replace the same three files and reload Obsidian. Settings live in `data.json`
alongside them and are preserved; unknown or malformed values fall back to their
defaults rather than breaking startup.

## Removing it

Disable the plugin in **Settings → Community plugins**, then delete
`<YourVault>/.obsidian/plugins/cerebrum/`. Nothing else in the vault is touched:
Cerebrum never writes to notes, so there is nothing to clean up.
