---
name: omega-organize
description: Prepare reviewable organization suggestions for notes in an Omega Centaur Obsidian vault. Use when the user asks an AI assistant to sort new or unplaced notes into their existing note types, areas, and MOCs.
---

# Omega Organize

Help the user place notes in their own information architecture. Work on the exact vault they name. If they requested a test copy, use that copy and leave the source vault alone.

Read the vault's existing `type`, `umbrella`, `area`, and `status` values and its MOC notes before proposing categories. Read candidate notes and a small number of relevant neighboring notes for context. Prefer existing categories and MOCs. A wikilink establishes a connection, not necessarily a semantic relationship. Explain the evidence for every proposed placement and mark uncertainty plainly.

Generate proposals only for notes the user asked to organize. If they say to organize new ideas, inspect `Omega Inbox` and propose placements for its notes. Do not edit Markdown notes, rename files, create MOCs, or change frontmatter. Omega Centaur presents each proposal for human review and applies accepted changes through Obsidian.

Create a UTF-8 draft JSON file with this shape:

```json
{
  "schemaVersion": 1,
  "proposals": [
    {
      "note": "Example note.md",
      "fields": {
        "type": "work-product",
        "area": "work-product",
        "moc": "Work Product MOC.md"
      },
      "reason": "The note describes a deliverable and links to related work in this MOC."
    }
  ]
}
```

`note` and `moc` are exact vault-relative Markdown paths. Supported fields are `type`, `umbrella`, `area`, `status`, and `moc`; omit fields you cannot support. Avoid replacing a meaningful existing value unless the user specifically asked for recategorization. Keep reasons concise and grounded in the note or nearby notes. Do not include note bodies, credentials, or private excerpts in the proposal file.

Run `scripts/write_proposals.py <vault-path> <draft-json-path>` to validate the draft, attach each note's modification time, and put the review queue in Omega Centaur's plugin folder. If the vault uses a custom Obsidian config folder, pass `--config-dir <folder>` as well. The script preserves pending proposals for other notes. If it reports an error, fix the draft and rerun it. Tell the user how many proposals are ready, and direct them to **Omega Centaur → Organize notes** to review them.
