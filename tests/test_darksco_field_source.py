from __future__ import annotations

import json
from pathlib import Path

import pytest

from darksco.instruments.field_source import FieldSourceError, validate_field_source


ROOT = Path(__file__).resolve().parents[1]
FIELD_ROOT = ROOT / "max-for-live" / "darksco-field"
MAIN = FIELD_ROOT / "DARKSCO-FIELD.maxpat"
VOICE = FIELD_ROOT / "field_voice.maxpat"


def _texts(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [box["box"].get("text", "") for box in data["patcher"]["boxes"]]


def test_repository_field_source_is_release_gate_ready() -> None:
    result = validate_field_source(FIELD_ROOT)
    assert result["status"] == "source-verified"
    assert result["voices"] == 64
    assert result["parameters"] == [
        "Density",
        "Instability",
        "Motion",
        "Space",
        "Spread",
        "Texture",
    ]


def test_field_main_source_declares_64_voice_poly() -> None:
    assert "poly~ field_voice 64 @parallel 1" in _texts(MAIN)


def test_field_voice_uses_only_builtin_source_dependencies() -> None:
    data = json.loads(VOICE.read_text(encoding="utf-8"))
    assert data["patcher"].get("dependency_cache", []) == []


def test_source_validator_rejects_missing_voice_dependency(tmp_path: Path) -> None:
    main = json.loads(MAIN.read_text(encoding="utf-8"))
    voice = VOICE.read_text(encoding="utf-8")
    main["patcher"]["dependency_cache"] = []
    (tmp_path / "DARKSCO-FIELD.maxpat").write_text(json.dumps(main), encoding="utf-8")
    (tmp_path / "field_voice.maxpat").write_text(voice, encoding="utf-8")

    with pytest.raises(FieldSourceError, match="dependency"):
        validate_field_source(tmp_path)


def test_source_validator_rejects_parameter_drift(tmp_path: Path) -> None:
    main = json.loads(MAIN.read_text(encoding="utf-8"))
    voice = VOICE.read_text(encoding="utf-8")
    del main["patcher"]["parameters"]["space"]
    (tmp_path / "DARKSCO-FIELD.maxpat").write_text(json.dumps(main), encoding="utf-8")
    (tmp_path / "field_voice.maxpat").write_text(voice, encoding="utf-8")

    with pytest.raises(FieldSourceError, match="parameter mismatch"):
        validate_field_source(tmp_path)
