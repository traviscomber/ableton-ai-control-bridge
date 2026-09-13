from __future__ import annotations

import argparse
import json
from pathlib import Path

PROCESSING_ORDER = {
    "EQ Eight": 10,
    "Compressor": 20,
    "Glue Compressor": 20,
    "Saturator": 30,
    "Drum Buss": 35,
    "Auto Filter": 40,
    "Utility": 50,
    "Echo": 60,
    "Hybrid Reverb": 70,
    "Limiter": 90,
}

DEVICE_STAGE = {
    "EQ Eight": "tone",
    "Compressor": "dynamics",
    "Glue Compressor": "dynamics",
    "Saturator": "harmonics",
    "Drum Buss": "harmonics_dynamics",
    "Auto Filter": "tone_movement",
    "Utility": "stereo_gain",
    "Echo": "space",
    "Hybrid Reverb": "space",
    "Limiter": "safety",
}

ROLE_HINTS = {
    "kick": ["cleanup rumble", "shape low-mid boxiness", "preserve transient", "avoid broadband limiting unless peaks demand it"],
    "bass": ["protect sub range", "carve kick overlap", "stabilize dynamics", "keep low end mono", "prefer kick-triggered movement over static level loss"],
    "motif": ["high-pass unnecessary lows", "control resonances", "preserve presence and movement", "leave center space for kick/bass"],
    "hat": ["high-pass lows", "control harshness", "preserve transient detail", "avoid unnecessary limiting"],
    "perc": ["remove lows", "shape attack", "control peaks conservatively", "keep groove dynamics"],
    "pad": ["high-pass aggressively", "leave headroom", "use width above low frequencies", "avoid masking motif/voice"],
    "atmos": ["remove lows", "control resonant peaks", "prefer spatial processing over loudness", "protect master headroom"],
    "voice": ["remove rumble", "control presence peaks", "compress only enough for intelligibility", "keep delays/reverb behind dry signal"],
    "fx": ["control extreme peaks", "avoid masking kick/bass", "use limiter only when structurally necessary", "filter transition energy contextually"],
}


def role_for(name: str) -> str:
    low = name.lower()
    for role in ("kick", "bass", "motif", "hat", "perc", "pad", "atmos", "voice", "fx"):
        if role in low:
            return role
    return "other"


def iter_targets(audit: dict):
    for group in ("tracks", "returns"):
        for target in audit.get(group, []):
            yield target
    master = audit.get("master")
    if master:
        yield master


def main() -> None:
    parser = argparse.ArgumentParser(description="Build an exact-index, review-first processing plan from a TITAN audit.")
    parser.add_argument("audit", type=Path)
    parser.add_argument("--output", type=Path, default=Path("titan-processing-plan.json"))
    args = parser.parse_args()

    audit = json.loads(args.audit.read_text(encoding="utf-8-sig"))
    plan = {
        "schema": 2,
        "source_audit": str(args.audit),
        "bridge_version": audit.get("bridge_version"),
        "mode": "review_required",
        "mix_policy": {
            "priority": ["kick_bass_relationship", "headroom", "corrective_eq", "dynamics", "harmonics", "space", "master_safety"],
            "limiter_policy": "last_resort_peak_control",
            "quantized_policy": "blocked_until_explicitly_approved",
            "large_move_policy": "blocked_by_apply_script_unless_explicit_override",
            "audible_gate": "required_after_each_role_group",
        },
        "rules": [
            "Every executable change targets exact device_index + parameter_index.",
            "proposed_normalized must remain null until reviewed in context.",
            "Duplicate device and parameter names are safe only through indexed execution.",
            "Quantized parameters require approve_quantized=true.",
            "Limiter is last-resort peak control, not a substitute for gain staging.",
            "Process KICK+BASS first, then MOTIF, drums, spatial layers, FX, returns, and master.",
        ],
        "targets": [],
    }

    for target in iter_targets(audit):
        kind = target.get("target_kind")
        role = role_for(target.get("name", "")) if kind == "track" else kind or "other"
        entry = {
            "target_kind": kind,
            "index": target.get("index"),
            "name": target.get("name"),
            "role": role,
            "role_hints": ROLE_HINTS.get(role, []),
            "review_priority": 1 if role in {"kick", "bass"} else 2 if role == "motif" else 3 if kind == "track" else 4 if kind == "return" else 5,
            "devices": [],
        }
        for device in sorted(target.get("devices", []), key=lambda d: PROCESSING_ORDER.get(d.get("name"), 999)):
            device_name = device.get("name")
            device_entry = {
                "device_index": device.get("device_index"),
                "device_name": device_name,
                "stage": DEVICE_STAGE.get(device_name, "other"),
                "duplicate_device_name": bool(device.get("duplicate_name")),
                "parameters": [],
            }
            for p in device.get("parameters", []):
                device_entry["parameters"].append({
                    "parameter_index": p.get("index"),
                    "parameter_name": p.get("name"),
                    "current_normalized": p.get("normalized"),
                    "current_native": p.get("value"),
                    "min": p.get("min"),
                    "max": p.get("max"),
                    "is_enabled": p.get("is_enabled"),
                    "is_quantized": p.get("is_quantized"),
                    "duplicate_parameter_name": bool(p.get("duplicate_name")),
                    "proposed_normalized": None,
                    "approve_quantized": False,
                    "rationale": "",
                    "audible_goal": "",
                    "confidence": None,
                })
            entry["devices"].append(device_entry)
        plan["targets"].append(entry)

    plan["targets"].sort(key=lambda item: (item.get("review_priority", 99), item.get("index") if item.get("index") is not None else 9999))
    args.output.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    print(f"Wrote review plan: {args.output}")
    print("No Ableton parameters were changed.")
    print("Review order: KICK+BASS -> MOTIF -> drums/layers -> returns -> master.")


if __name__ == "__main__":
    main()
