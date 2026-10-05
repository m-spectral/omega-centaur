# Omega Centaur

Omega Centaur turns your vault into a rotating map. Each Markdown note sits on a sphere, and links follow arcs across its surface. Rotate the globe, move notes, search by title, and select a group to find its place.

Version 2 builds on that map. Search now gives you a direct route to a note, and a new Inbox helps you give notes a place in your existing maps of content.

## Origin of Ideas

Globular clusters are tightly bound collections of stars held together by their own gravity. That gravity gives them a nearly spherical shape. [Omega Centauri](https://www.esa.int/ESA_Multimedia/Images/2019/07/A_puzzle_of_10_million_stars), one of the largest examples visible from Earth, contains roughly 10 million stars. In this map, your notes form the cluster and their links show how the ideas connect.

## You can rotate, move notes, and search

- Drag empty space to rotate the globe through 360 degrees. Scroll to zoom.
- Drag a note to move it along the sphere. Linked notes respond when physics is enabled. Click a note to open it.
- Focus the globe and use the arrow keys to rotate in small steps. Select a note, then press Shift and an arrow key to nudge it.
- Search beneath the globe. Matching notes light up and the camera turns toward them. Press Escape to clear the search and return to the globe.
- Hover over a group in the right-hand list to isolate it. Click a group, or focus it and press Enter or Space, to turn the globe toward that group. Its notes stay visible. Click the selected group again, click its highlighted note, or press Escape to clear the selection. The globe resumes spinning if Auto-rotate is enabled.

Grouping starts with your Map of Content hierarchy. Omega Centaur recognizes `type: moc`, `Index`, and note names ending in `MOC`. A child MOC can point to its parent with an `↑ [[Parent]]` breadcrumb. Settings also let you group by folder or a frontmatter key.

## Version 2 makes search a shorter path to your notes

The search field is ready when the globe opens. Search matches titles, aliases, and group names. Results show each note's location. Use the arrow keys to choose a result and Enter to open its note. Click a result to turn the globe toward it, choose **Open** to open the note, or choose **Place** to attach it to a map of content. **Search the globe** in the command palette focuses the field from anywhere in Obsidian.

The right-hand list now works as a set of locations. Select a group to turn toward its node, then select it again or press Escape to return to the full spinning globe.

## Version 2 gives new notes a place

Select **Capture idea**, write a thought, and select **Save note**. Omega creates a Markdown note in `Omega Inbox` using its first line as the title. Pressing Command/Control and Enter also saves it. The globe stays open and shows the new note in the Inbox tray.

The Inbox shows captured notes and, when grouping by MOC, other vault notes still shown as **Unfiled**. Notes that need a location appear under **To place**; captured notes already attached to a MOC appear under **Placed**. Select **Attach** or **Change**, search for a MOC, and choose that location. You can also drag a note card onto a MOC in the right-hand list. The tray closes after placement, and you can close it with its Close button, Escape, or a click outside it.

Placement adds a `moc` link to the note and moves its globe group. It does not combine note contents or move the Markdown file. **Undo last attachment** reverses the most recent placement. A placed note outside `Omega Inbox` leaves the Inbox queue and remains findable through search.

A note can declare its MOC with a `moc` property containing a link; existing links to MOCs also work. If a vault has no MOCs, Omega starts with note types when available, then folders, then all notes.

## New notes appear without reopening the view

The map updates when you add, rename, or delete a Markdown note. Obsidian may need a moment to index a new note and its links. Existing node positions stay in place during the refresh. If a note or link is missing, run **Omega Centaur: Refresh globe** from the command palette.

## Local installation takes three files

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/omega-centaur/`. Enable Omega Centaur under Community plugins, then open it from the ribbon or command palette. The same three files are the GitHub release assets.

The manifest sets `minAppVersion` to `1.13.7`, the Obsidian desktop version used for the Version 2 live test. Older Obsidian versions have not been verified.

## Position persistence, scale, and mobile support

- Manual node positions stay put during map refreshes and after you close the view or restart the plugin. Notes you have moved stay fixed while the remaining notes can settle around them.
- Physics compares every pair of notes, so very large vaults can be slow. Exclude folders in settings if needed.
- Desktop is the principal support.
- Mobile is not yet supported.

## Your vault data stays local

Omega Centaur calls `app.vault.getMarkdownFiles()` to list every Markdown note path in the vault. It needs that full list to show every note on the globe, connect notes through their links, build groups and search results, and find MOCs and Inbox notes. It does not call `getFiles()` to list attachments or other file types.

For the globe, Omega uses file names for titles and Obsidian's metadata cache for aliases, properties, and links. It reads MOC note text to find the `↑ [[Parent]]` breadcrumb; it does not read the bodies of other notes to build the globe. This work stays on your device. The plugin makes no network requests or uploads of vault paths or note content.

**Exclude folders** hides matching notes from the map and search results after Omega has listed the Markdown paths. It is a display and performance setting, not an access control. Capturing an idea creates a note in `Omega Inbox`. Placing a note changes that note's `moc` property after you choose a MOC.

## Release files can be verified

The `2.0.0` release tag matches the version in `manifest.json`. Its GitHub Actions run attested the exact `main.js`, `styles.css`, and `manifest.json` files published as release assets. Download an asset and verify it with `gh attestation verify main.js -R m-spectral/omega-centaur` (repeat for `styles.css` and `manifest.json`).

## Sample Images from Version 1

### Hover over a group in the right-hand list to isolate it

<img width="1131" height="919" alt="Omega Centaur 1" src="https://github.com/user-attachments/assets/3416f6af-0f20-40ce-b8de-073379ad0277" />

### Drag empty space to rotate the globe through 360 degrees. Scroll to zoom.

<img width="1125" height="912" alt="Omega Centaur 2" src="https://github.com/user-attachments/assets/80dcaf52-bba7-4ef4-9f47-efc542c88848" />

### Search note titles beneath the globe.

<img width="1131" height="915" alt="Omega Centaur 3" src="https://github.com/user-attachments/assets/b2a3c969-639b-4bca-b661-3978846f3edb" />

## License

Read the [license](LICENSE) before reusing or distributing the source.

Created by [B. Munoz](https://github.com/m-spectral). [Support development](https://buymeacoffee.com/morphystrategyco).
