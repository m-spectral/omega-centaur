# Omega Centaur

Omega Centaur helps you find and organize notes on a rotating globe. Notes sit on the sphere; links follow arcs across its surface. Search for a note, turn to its location, and keep a manual arrangement that survives reopening the view.

## Find a note

Open Omega Centaur from the ribbon or command palette. Its search field is ready when the globe opens. Search matches note titles, aliases, and group names. The result list shows where each note belongs. Use the arrow keys to choose a result, Enter to open it, or Escape to clear the search and return to the globe. Click a result to locate it or select **Open** to open its note directly. The **Search the globe** command focuses the field from anywhere in Obsidian.

Click a group in the right-hand legend to turn toward it. Click that group again, click its highlighted note, or press Escape to return to the full spinning globe. Click another note to open it. Drag empty space to rotate through 360 degrees and scroll to zoom.

## Give notes a place

Select **Capture idea** on the globe, write a thought, and select **Save note**. Omega makes a Markdown note in `Omega Inbox` using its first line as the title. You can also save with Command/Control and Enter. There is no category form to complete first. The companion skill can propose properties and a MOC for your review. Accepting a suggestion changes the note's properties and globe group; the file stays in `Omega Inbox` until you move it in Obsidian.

Drag a note to move it on the sphere. Select a note and press Shift plus an arrow key for a small adjustment. Omega saves manual positions across refreshes and restarts. Notes you have positioned stay fixed while the remaining notes can settle around them.

Grouping starts with your Map of Content (MOC) hierarchy. Omega recognizes `type: moc`, `Index`, and note names ending in `MOC`. A child MOC can point to its parent with an `↑ [[Parent]]` breadcrumb. A note can declare its MOC with a `moc` property containing a link; existing links to MOCs also work. If a vault has no MOCs, Omega starts with note types when available, then folders, then all notes. Settings also let you choose a frontmatter property for grouping.

New and changed notes usually appear automatically after Obsidian indexes them. If a new note or link is missing, run **Omega Centaur: Refresh globe** from the command palette.

## Review AI organization suggestions

The companion [Omega Organize skill](skills/omega-organize/SKILL.md) reads the vault you specify and prepares proposals from its existing note types, areas, statuses, and MOCs. Ask Codex to organize notes in `Omega Inbox`, or name specific notes. The skill does not change notes. In Omega, select **Organize notes** to review each proposal, open the note, apply it, skip it, or undo the last applied change. Omega writes accepted properties using Obsidian's frontmatter API. An explicit `moc` property links the note to its chosen MOC.

To try it from this checkout, tell Codex: “Use `skills/omega-organize/SKILL.md` to suggest places for notes in `Omega Inbox` of my test vault. Stage suggestions for review; leave the notes unchanged.” Give Codex the test vault's path. The skill is kept with the source so it can be published alongside the plugin later.

This first integration uses Codex as the AI counterpart. Omega does not call an AI service or require an API key. The skill stages proposals in the vault's `.obsidian/plugins/omega-centaur/organize-proposals.json`; the plugin reads that local file when you open the review panel. The file contains note paths, proposed properties, reasons, and modification times, not note bodies. Proposals made before a note changes must be regenerated.

## Install and test

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/omega-centaur/`, then enable Omega Centaur under Community plugins. The skill folder is for Codex and is not copied into the Obsidian plugin folder. This version is an experimental development branch; it is not a Community directory release.

The globe renders locally and sends no vault data to a server. Omega currently targets desktop. Physics compares every pair of notes, so very large vaults may slow down; use **Exclude folders** in settings if needed. Mobile behavior has not been verified.

## Name and license

Globular clusters are massive, tightly bound collections of stars held together by their mutual gravity, which gives them a nearly spherical shape. [Omega Centauri](https://www.esa.int/ESA_Multimedia/Images/2019/07/A_puzzle_of_10_million_stars) is one of the largest examples visible from Earth and contains roughly 10 million stars. Your notes form a cluster of ideas on this map.

The source is GPL-3.0-only. Created by [B. Munoz](https://github.com/m-spectral). [Support development](https://buymeacoffee.com/morphystrategyco).
