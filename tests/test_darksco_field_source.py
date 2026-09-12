from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "max-for-live" / "darksco-field" / "DARKSCO-FIELD.maxpat"
VOICE = ROOT / "max-for-live" / "darksco-field" / "field_voice.maxpat"


def _texts(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        box["box"].get("text", "")
        for box in data["patcher"]["boxes"]
    ]


def test_field_main_source_declares_64_voice_poly() -> None:
    assert "poly~ field_voice 64 @parallel 1" in _texts(MAIN)


def test_field_exposes_semantic_parameter_names() -> None:
    data = json.loads(MAIN.read_text(encoding="utf-8"))
    parameters = data["patcher"]["parameters"]
    long_names = {entry[0] for key, entry in parameters.items() if key != "parameterbanks"}
    assert long_names == {"Density", "Spread", "Motion", "Instability", "Texture", "Space"}


def test_field_voice_uses_only_builtin_source_dependencies() -> None:
    data = json.loads(VOICE.read_text(encoding="utf-8"))
    assert data["patcher"].get("dependency_cache", []) == []


def test_field_space_has_wet_path_and_safety_clip() -> None:
    texts = _texts(MAIN)
    assert "tapin~ 2500" in texts
    assert "clip~ -0.95 0.95" in texts
