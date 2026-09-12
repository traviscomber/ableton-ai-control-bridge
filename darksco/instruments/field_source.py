from __future__ import annotations

import json
from pathlib import Path

FIELD_PARAMETER_NAMES = {
    "Density",
    "Spread",
    "Motion",
    "Instability",
    "Texture",
    "Space",
}


class FieldSourceError(ValueError):
    """Raised when DARKSCO FIELD Max source violates the release scaffold contract."""


def _load_patch(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FieldSourceError(f"Cannot read valid Max patch JSON: {path}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("patcher"), dict):
        raise FieldSourceError(f"Missing patcher object: {path}")
    return data["patcher"]


def validate_field_source(root: str | Path) -> dict[str, object]:
    """Validate the source-level invariants required before opening Max for Live.

    This is intentionally not a runtime or packaged-device validator. It only
    proves that the repository source is internally consistent enough to enter
    the Max/Ableton release gate.
    """
    root = Path(root)
    main_path = root / "DARKSCO-FIELD.maxpat"
    voice_path = root / "field_voice.maxpat"
    main = _load_patch(main_path)
    voice = _load_patch(voice_path)

    boxes = [item.get("box", {}) for item in main.get("boxes", [])]
    texts = {box.get("text") for box in boxes if isinstance(box.get("text"), str)}

    expected_poly = "poly~ field_voice 64 @parallel 1"
    if expected_poly not in texts:
        raise FieldSourceError(f"Expected 64-voice engine: {expected_poly}")

    if "plugout~" not in texts:
        raise FieldSourceError("Main patch must expose plugout~ stereo output.")

    dependency_names = {
        entry.get("name")
        for entry in main.get("dependency_cache", [])
        if isinstance(entry, dict)
    }
    if "field_voice.maxpat" not in dependency_names:
        raise FieldSourceError("field_voice.maxpat must be declared as a dependency.")

    parameters = main.get("parameters", {})
    exposed = {
        value[0]
        for key, value in parameters.items()
        if key != "parameterbanks" and isinstance(value, list) and value
    }
    missing = FIELD_PARAMETER_NAMES - exposed
    extra = exposed - FIELD_PARAMETER_NAMES
    if missing or extra:
        raise FieldSourceError(
            f"FIELD parameter mismatch; missing={sorted(missing)}, extra={sorted(extra)}"
        )

    line_pairs = {
        (tuple(line.get("patchline", {}).get("source", [])), tuple(line.get("patchline", {}).get("destination", [])))
        for line in main.get("lines", [])
        if isinstance(line, dict)
    }
    required_delay_links = {
        (("tapinl", 0), ("tapoutl", 0)),
        (("tapinr", 0), ("tapoutr", 0)),
    }
    missing_delay = required_delay_links - line_pairs
    if missing_delay:
        raise FieldSourceError(f"Incomplete stereo delay routing: {sorted(missing_delay)}")

    voice_boxes = [item.get("box", {}) for item in voice.get("boxes", [])]
    voice_texts = {box.get("text") for box in voice_boxes if isinstance(box.get("text"), str)}
    for required in {"thispoly~", "mute 0", "cycle~", "noise~", "pan2~"}:
        if required not in voice_texts:
            raise FieldSourceError(f"Voice patch missing required object/message: {required}")

    return {
        "status": "source-verified",
        "voices": 64,
        "parameters": sorted(FIELD_PARAMETER_NAMES),
        "main": str(main_path),
        "voice": str(voice_path),
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Validate DARKSCO FIELD Max source before Live 11 runtime testing.")
    parser.add_argument(
        "root",
        nargs="?",
        default="max-for-live/darksco-field",
        help="Directory containing DARKSCO-FIELD.maxpat and field_voice.maxpat",
    )
    args = parser.parse_args()
    result = validate_field_source(args.root)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
