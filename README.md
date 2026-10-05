# Omega Centaur

Omega Centaur turns your vault into a rotating map. Each Markdown note sits on a sphere, and links follow arcs across its surface. Rotate the globe, move notes, search by title, and select a group to find its place.

Version 2 builds on that map. Search now gives you a direct route to a note, and a new Inbox helps you give notes a place in your existing maps of content.

## The name reflects a cluster of ideas

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

## Position persistence, scale, and mobile support

- Manual node positions now survive a map refresh, closing the view, and restarting the plugin. Notes you have moved stay fixed while the remaining notes can settle around them.
- Physics compares every pair of notes, so very large vaults can be slow. Exclude folders in settings if needed.
- Desktop is the supported target. Mobile interaction has not been verified.

## Your vault data stays local

Omega Centaur lists the paths of all Markdown notes to build the full globe and search index. It uses file names for titles and Obsidian's metadata cache for aliases, properties, and links. It reads MOC note text to find the `↑ [[Parent]]` breadcrumb. It does not read the bodies of other notes to build the globe or send vault data to a server.

**Exclude folders** removes matching notes from the map and search results. Omega still sees their paths while applying the filter; this setting is for display and performance, not access control. Capturing an idea creates a note in `Omega Inbox`. Placing a note changes that note's `moc` property after you choose a MOC.

## Release files can be verified

The GitHub release tag must match the version in `manifest.json`. GitHub Actions checks the code, attests the exact `main.js`, `styles.css`, and `manifest.json` bytes, and uploads those files as release assets. After publication, download an asset and verify it with `gh attestation verify main.js -R m-spectral/omega-centaur` (repeat for `styles.css`). Attestations are generated when the release workflow runs.

## The source is GPL-3.0-only

Read the [license](LICENSE) before reusing or distributing the source.

Created by [B. Munoz](https://github.com/m-spectral). [Support development](https://buymeacoffee.com/morphystrategyco).
