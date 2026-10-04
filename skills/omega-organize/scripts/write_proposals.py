#!/usr/bin/env python3
"""Validate AI suggestions and stage them for Omega Centaur review."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import tempfile

ALLOWED_FIELDS = {"type", "umbrella", "area", "status", "moc"}


def inside_note(vault: Path, raw: str) -> Path:
    if not isinstance(raw, str) or not raw or "\\" in raw:
        raise ValueError(f"Invalid note path: {raw!r}")
    rel = PurePosixPath(raw)
    if rel.is_absolute() or ".." in rel.parts or rel.suffix.lower() != ".md":
        raise ValueError(f"Invalid note path: {raw!r}")
    path = (vault / Path(*rel.parts)).resolve()
    if not path.is_relative_to(vault) or not path.is_file():
        raise ValueError(f"Note is missing or outside vault: {raw!r}")
    return path


def validate(vault: Path, draft: dict) -> list[dict]:
    if draft.get("schemaVersion") != 1 or not isinstance(draft.get("proposals"), list):
        raise ValueError("Expected schemaVersion 1 and a proposals array")
    if len(draft["proposals"]) > 100:
        raise ValueError("Limit each run to 100 notes")
    result, seen = [], set()
    for item in draft["proposals"]:
        if not isinstance(item, dict):
            raise ValueError("Each proposal must be an object")
        note = item.get("note")
        path = inside_note(vault, note)
        if note in seen:
            raise ValueError(f"Duplicate proposal: {note}")
        seen.add(note)
        fields = item.get("fields")
        if not isinstance(fields, dict) or not fields or set(fields) - ALLOWED_FIELDS:
            raise ValueError(f"Unsupported or empty fields for {note}")
        for key, value in fields.items():
            if not isinstance(value, str) or not value.strip() or len(value) > 120 or "\n" in value or "\r" in value:
                raise ValueError(f"Invalid {key} for {note}")
            if key == "moc":
                inside_note(vault, value)
        reason = item.get("reason", "")
        if not isinstance(reason, str) or len(reason) > 500:
            raise ValueError(f"Invalid reason for {note}")
        result.append({"note": note, "mtime": round(path.stat().st_mtime * 1000),
                       "fields": fields, "reason": reason})
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vault", type=Path)
    parser.add_argument("draft", type=Path)
    parser.add_argument("--config-dir", default=".obsidian",
                        help="Obsidian config folder inside the vault (default: .obsidian)")
    args = parser.parse_args()
    vault = args.vault.expanduser().resolve()
    config_dir = Path(args.config_dir)
    if config_dir.is_absolute() or ".." in config_dir.parts or not config_dir.parts:
        raise ValueError("Config directory must be inside the vault")
    plugin_dir = (vault / config_dir / "plugins" / "omega-centaur").resolve()
    if not plugin_dir.is_relative_to(vault):
        raise ValueError("Config directory must be inside the vault")
    manifest = plugin_dir / "manifest.json"
    if not manifest.is_file() or json.loads(manifest.read_text()).get("id") != "omega-centaur":
        raise ValueError("Omega Centaur is not installed in this vault")
    draft = json.loads(args.draft.read_text(encoding="utf-8"))
    proposals = validate(vault, draft)
    target = plugin_dir / "organize-proposals.json"
    existing = []
    if target.exists():
        old = json.loads(target.read_text(encoding="utf-8"))
        if old.get("schemaVersion") == 1 and isinstance(old.get("proposals"), list):
            existing = [p for p in old["proposals"] if isinstance(p, dict)]
    replacement = {p["note"] for p in proposals}
    merged = [p for p in existing if p.get("note") not in replacement] + proposals
    payload = json.dumps({"schemaVersion": 1, "proposals": merged}, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=plugin_dir, delete=False) as tmp:
        tmp.write(payload)
        temp_path = Path(tmp.name)
    try:
        os.replace(temp_path, target)
    finally:
        temp_path.unlink(missing_ok=True)
    print(f"Staged {len(proposals)} proposal(s) for review; {len(merged)} pending in Omega Centaur.")


if __name__ == "__main__":
    main()
