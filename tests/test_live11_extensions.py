from ableton_bridge.commands import validate_command


def test_readback_commands_validate() -> None:
    assert validate_command({"type": "get_live_state"})["type"] == "get_live_state"
    assert validate_command({"type": "list_tracks"})["type"] == "list_tracks"
    assert validate_command({"type": "inspect_track", "track": 0})["track"] == 0
    assert validate_command({"type": "list_returns"})["type"] == "list_returns"
    assert validate_command({"type": "inspect_device_chain", "target_kind": "master"})["target_kind"] == "master"
    assert validate_command({
        "type": "inspect_device_parameters",
        "target_kind": "track",
        "track_ref": "kick",
        "device": "Operator",
    })["device"] == "Operator"
    assert validate_command({"type": "inspect_clip", "track": 0, "clip": 0})["clip"] == 0
    assert validate_command({"type": "inspect_master"})["type"] == "inspect_master"


def test_snapshot_commands_validate() -> None:
    assert validate_command({"type": "capture_mixer_snapshot", "snapshot_id": "before-premix"})["snapshot_id"] == "before-premix"
    assert validate_command({"type": "restore_mixer_snapshot", "snapshot_id": "before-premix"})["snapshot_id"] == "before-premix"
    assert validate_command({
        "type": "capture_device_snapshot",
        "target_kind": "return",
        "return": 0,
        "device": "Reverb",
        "snapshot_id": "return-a",
    })["snapshot_id"] == "return-a"
    assert validate_command({"type": "restore_device_snapshot", "snapshot_id": "return-a"})["snapshot_id"] == "return-a"


def test_master_commands_validate() -> None:
    assert validate_command({"type": "set_master_volume", "volume": 0.75})["volume"] == 0.75
    assert validate_command({
        "type": "set_master_device_parameter",
        "device": "Glue Compressor",
        "parameter": "Threshold",
        "value": 0.5,
    })["value"] == 0.5
    assert validate_command({
        "type": "set_master_device_enabled",
        "device": "Limiter",
        "enabled": True,
    })["enabled"] is True
