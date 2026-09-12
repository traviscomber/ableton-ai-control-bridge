from __future__ import annotations

import json
import os
from pathlib import Path

from .commands import COMMANDS

APP_NAME = "Ableton AI Control Bridge"


def default_config_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return base / APP_NAME / "config.json"


def migrate_default_allowlist(path: Path | None = None) -> bool:
    """Upgrade desktop-generated allowlists when new bridge commands are added.

    Older desktop installs stored a snapshot of every command available at the
    time the config was first created. Because the desktop only writes the file
    once, later commands could be rejected with HTTP 403 even though the token
    was valid. We only auto-expand configs that still look like the historical
    desktop default (a broad allowlist). Explicitly restricted/custom allowlists
    remain untouched.
    """
    config_path = path or default_config_path()
    if not config_path.exists():
        return False

    try:
        config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return False

    allow = config.get("allow")
    if not isinstance(allow, list):
        return False

    current = {str(item).strip() for item in allow if str(item).strip()}
    known = set(COMMANDS)
    missing = known - current
    if not missing:
        return False

    # Desktop default configs have historically allowed essentially the whole
    # bridge. Do not widen a deliberately narrow security policy.
    if len(current) < max(8, len(known) // 2):
        return False

    config["allow"] = sorted(current | known)
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return True
