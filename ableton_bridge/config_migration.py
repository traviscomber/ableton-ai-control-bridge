from __future__ import annotations

import json
import os
from pathlib import Path

from .commands import COMMANDS

APP_NAME = "Ableton AI Control Bridge"
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def default_config_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    return base / APP_NAME / "config.json"


def _load_config(config_path: Path) -> dict | None:
    try:
        config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    return config if isinstance(config, dict) else None


def migrate_local_loopback_auth(path: Path | None = None) -> bool:
    """Disable browser-token friction when the bridge is loopback-only.

    The desktop bridge binds to 127.0.0.1 by default, so only applications on
    the same Windows machine can reach it. In that configuration a per-browser
    token adds friction without adding a meaningful network boundary: Chrome,
    Opera, scripts and local tools should all be able to use the same console.

    If the bridge is ever configured on 0.0.0.0 or any non-loopback host, the
    token is preserved and remains mandatory.
    """
    config_path = path or default_config_path()
    if not config_path.exists():
        return False

    config = _load_config(config_path)
    if config is None:
        return False

    host = str(config.get("host", "127.0.0.1")).strip().lower()
    if host not in LOOPBACK_HOSTS:
        return False
    if not config.get("token"):
        return False

    config["token"] = None
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return True


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

    config = _load_config(config_path)
    if config is None:
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
