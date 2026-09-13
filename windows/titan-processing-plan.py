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

ROLE_HINTS = {
    "kick": ["cleanup rumble", "shape low-mid boxiness", "control transient only if needed"],
    "bass": ["protect sub range", "carve kick overlap", "stabilize dynamics", "keep low end mono"],
    "motif": ["high-pass unnecessary lows", "control resonances", "preserve presence and movement"],
    "hat": ["high-pass lows", "control harshness", "avoid unnecessary limiting"],
    "perc": ["remove lows", "shape attack", "control peaks conservatively"],
    "pad": ["high-pass aggressively", "leave headroom", "use width above low frequencies"],
    "atmos": ["remove lows", "control resonant peaks", "prefer spatial processing over loudness"],
    "voice": ["remove rumble", "control presence peaks", "compress only enough for intelligibility"],
    "fx": ["control extreme peaks", "avoid masking kick/bass", "use limiter only when structurally necessary"],
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
    parser = argparse.ArgumentParser(description="Build a safe exact-index processing plan skeleton from a TITAN audit.")
    parser.add_argument("audit", type=Path)
    parser.add_argument("--output", type=Path, default=Path("titan-processing-plan.json"))
    args = parser.parse_args()

    audit = json.loads(args.audit.read_text(encoding="utf-8-sig"))
    plan = {
        "schema": 1,
        "source_audit": str(args.audit),
        "bridge_version": audit.get("bridge_version"),
        "mode": "review_required",
        "rules": [
            "Every executable change targets exact device_index + parameter_index.",
            "proposed_normalized must remain null until reviewed in context.",
            "Duplicate device names are blocked from automatic execution unless explicitly disambiguated.",
            "Limiter is last-resort peak control, not a substitute for gain staging.",
        ],
        "targets": [],
    }

    for target in iter_targets(audit):
        role = role_for(target.get("name", "")) if target.get("target_kind") == "track" else target.get("target_kind", "other")
        entry = {
            "target_kind": target.get("target_kind"),
            "index": target.get("index"),
            "name": target.get("name"),
            "role": role,
            "role_hints": ROLE_HINTS.get(role, []),
            "devices": [],
        }
        for device in sorted(target.get("devices", []), key=lambda d: PROCESSING_ORDER.get(d.get("name"), 999)):
            device_entry = {
                "device_index": device.get("device_index"),
                "device_name": device.get("name"),
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
                    "rationale": "",
                })
            entry["devices"].append(device_entry)
        plan["targets"].append(entry)

    args.output.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    print(f"Wrote review plan: {args.output}")
    print("No Ableton parameters were changed.")


if __name__ == "__main__":
    main()
