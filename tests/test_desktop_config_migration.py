from __future__ import annotations

from ableton_bridge.desktop import _migrate_config


def test_migrates_paged_inspection_for_legacy_inspection_config() -> None:
    original = {
        "token": "keep-me",
        "database": "history.sqlite3",
        "allow": ["inspect_device_chain", "inspect_device_parameters", "set_tempo"],
    }

    migrated, changed = _migrate_config(original)

    assert changed is True
    assert migrated["token"] == "keep-me"
    assert migrated["database"] == "history.sqlite3"
    assert migrated["allow"] == [
        "inspect_device_chain",
        "inspect_device_parameters",
        "inspect_device_parameters_page",
        "set_tempo",
    ]
    assert "inspect_device_parameters_page" not in original["allow"]


def test_does_not_widen_custom_config_without_device_inspection() -> None:
    original = {"allow": ["get_live_state", "set_tempo"]}

    migrated, changed = _migrate_config(original)

    assert changed is False
    assert migrated is original
    assert migrated["allow"] == ["get_live_state", "set_tempo"]


def test_migration_is_idempotent() -> None:
    original = {
        "allow": [
            "inspect_device_chain",
            "inspect_device_parameters",
            "inspect_device_parameters_page",
        ]
    }

    migrated, changed = _migrate_config(original)

    assert changed is False
    assert migrated is original
