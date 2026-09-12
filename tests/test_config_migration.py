import json

from ableton_bridge.commands import COMMANDS
from ableton_bridge.config_migration import migrate_default_allowlist


def test_migrates_broad_stale_default_allowlist(tmp_path):
    path = tmp_path / "config.json"
    historical = sorted(list(COMMANDS)[: max(8, len(COMMANDS) // 2)])
    path.write_text(json.dumps({"token": "abc", "allow": historical}), encoding="utf-8")

    assert migrate_default_allowlist(path) is True
    config = json.loads(path.read_text(encoding="utf-8"))
    assert set(config["allow"]) == set(COMMANDS)
    assert config["token"] == "abc"


def test_does_not_widen_explicitly_narrow_allowlist(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"allow": ["set_tempo", "start_playback"]}), encoding="utf-8")

    assert migrate_default_allowlist(path) is False
    config = json.loads(path.read_text(encoding="utf-8"))
    assert config["allow"] == ["set_tempo", "start_playback"]


def test_noop_when_allowlist_is_current(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"allow": sorted(COMMANDS)}), encoding="utf-8")

    assert migrate_default_allowlist(path) is False
