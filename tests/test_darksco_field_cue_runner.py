from __future__ import annotations

import pytest

import darksco.field_cue_runner as runner


def _cue():
    return {
        "section": "night",
        "track_ref": "field-main",
        "commands": [
            {
                "type": "set_device_parameter",
                "track_ref": "field-main",
                "device": "DARKSCO FIELD",
                "parameter": "Density",
                "value": 0.7,
            },
            {
                "type": "set_device_parameter",
                "track_ref": "field-main",
                "device": "DARKSCO FIELD",
                "parameter": "Space",
                "value": 0.8,
            },
        ],
    }


def test_execute_field_cue_waits_for_each_ack(monkeypatch):
    submitted = []
    acknowledged = []

    def fake_send(url, token, payload):
        submitted.append(payload["parameter"])
        return {"command": {"id": f"cmd-{len(submitted)}", "status": "submitted"}}

    def fake_wait(base_url, token, command_id, timeout):
        acknowledged.append(command_id)
        return {"command": {"id": command_id, "status": "acknowledged"}}

    monkeypatch.setattr(runner, "send", fake_send)
    monkeypatch.setattr(runner, "wait_for_ack", fake_wait)

    results = runner.execute_field_cue(_cue())
    assert submitted == ["Density", "Space"]
    assert acknowledged == ["cmd-1", "cmd-2"]
    assert [item["command"]["status"] for item in results] == ["acknowledged", "acknowledged"]


def test_execute_field_cue_stops_on_failed_ack(monkeypatch):
    submitted = []

    def fake_send(url, token, payload):
        submitted.append(payload["parameter"])
        return {"command": {"id": f"cmd-{len(submitted)}", "status": "submitted"}}

    def fake_wait(base_url, token, command_id, timeout):
        raise RuntimeError("receiver rejected parameter")

    monkeypatch.setattr(runner, "send", fake_send)
    monkeypatch.setattr(runner, "wait_for_ack", fake_wait)

    with pytest.raises(runner.FieldCueExecutionError, match="stopped at command 1"):
        runner.execute_field_cue(_cue())
    assert submitted == ["Density"]


def test_cue_from_manifest_requires_unique_section():
    manifest = {"schema": "darksco.field-cues/1.0", "cues": [_cue()]}
    assert runner.cue_from_manifest(manifest, "night")["track_ref"] == "field-main"

    with pytest.raises(runner.FieldCueExecutionError, match="found 0"):
        runner.cue_from_manifest(manifest, "morning")
