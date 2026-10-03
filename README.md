# Omega Centaur

Omega Centaur turns your vault into a rotating map. Each Markdown note sits on a sphere, and links follow arcs across its surface. Rotate the globe, move notes, search by title, and select a group to find its place.

## The name reflects a cluster of ideas

Globular clusters are tightly bound collections of stars held together by their own gravity. That gravity gives them a nearly spherical shape. [Omega Centauri](https://www.esa.int/ESA_Multimedia/Images/2019/07/A_puzzle_of_10_million_stars), one of the largest examples visible from Earth, contains roughly 10 million stars. In this map, your notes form the cluster and their links show how the ideas connect.

## You can rotate, move notes, and search

- Drag empty space to rotate the globe through 360 degrees. Scroll to zoom.
- Drag a note to move it along the sphere. Linked notes respond when physics is enabled. Click a note to open it.
- Focus the globe and use the arrow keys to rotate in small steps. Select a note, then press Shift and an arrow key to nudge it.
- Search note titles beneath the globe. Matching notes light up and the camera turns toward them. Press Enter to apply a search immediately or Escape to clear it.
- Hover over a group in the right-hand list to isolate it. Click a group, or focus it and press Enter or Space, to turn the globe toward that group. Its notes stay visible. Click the selected group again, click its highlighted note, or press Escape to clear the selection. The globe resumes spinning if Auto-rotate is enabled. After clearing the selection, a normal note click opens the file.

Grouping starts with your Map of Content hierarchy. Omega Centaur recognizes `type: moc`, `Index`, and note names ending in `MOC`. A child MOC can point to its parent with an `↑ [[Parent]]` breadcrumb. Settings also let you group by folder or a frontmatter key.

## New notes appear without reopening the view

The map updates when you add, rename, or delete a Markdown note. Obsidian may need a moment to index a new note and its links. Existing node positions stay in place during the refresh.

## Local installation takes three files

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/omega-centaur/`. Enable Omega Centaur under Community plugins, then open it from the ribbon or command palette. The plugin has not yet been published to the Community directory.

## Position persistence, scale, and mobile support remain limited

- Manual node positions survive a map refresh but reset when the view closes or the plugin restarts.
- Physics compares every pair of notes, so very large vaults can be slow. Exclude folders in settings if needed.
- Desktop is the supported target. Mobile interaction has not been verified.

## Your vault data stays local

Omega Centaur reads Markdown files in the current vault to build the map. It does not access files outside the vault or send data to a server.
## Sample Images

### Hover over a group in the right-hand list to isolate it

<img width="1131" height="919" alt="Omega Centaur 1" src="https://github.com/user-attachments/assets/3416f6af-0f20-40ce-b8de-073379ad0277" />

### Drag empty space to rotate the globe through 360 degrees. Scroll to zoom.
<img width="1125" height="912" alt="Omega Centaur 2" src="https://github.com/user-attachments/assets/80dcaf52-bba7-4ef4-9f47-efc542c88848" />

### Search note titles beneath the globe.

<img width="1131" height="915" alt="Omega Centaur 3" src="https://github.com/user-attachments/assets/b2a3c969-639b-4bca-b661-3978846f3edb" />


## License

Read the [license](LICENSE) before reusing or distributing the source.

Created by [B. Munoz](https://github.com/m-spectral). [Support development](https://buymeacoffee.com/morphystrategyco).
