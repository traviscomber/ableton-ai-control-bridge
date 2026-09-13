from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def load_analyses(folder: Path) -> list[dict]:
    out = []
    for path in folder.glob("*.json"):
        try:
            item = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            continue
        if "level" in item and "spectral_balance" in item:
            item["analysis_file"] = str(path)
            out.append(item)
    return out


def match(name: str, analyses: list[dict]) -> dict | None:
    wanted = key(name)
    compact = wanted[2:] if wanted.startswith("bv") else wanted
    for item in analyses:
        candidates = [Path(str(item.get("path", ""))).stem, Path(str(item.get("analysis_file", ""))).stem]
        if any(compact and compact in key(candidate) for candidate in candidates):
            return item
    return None


def assess(role: str, analysis: dict | None, devices: set[str]) -> list[dict]:
    if analysis is None:
        return [{"area": "measurement", "action": "render_required", "reason": "No matching WAV analysis found."}]

    level = analysis["level"]
    spectral = analysis["spectral_balance"]
    stereo = analysis.get("stereo", {})
    peak = float(level["peak_dbfs"])
    headroom = float(level["headroom_db"])
    crest = float(level["crest_db"])
    clipped = int(level["clipped_samples"])
    low = float(spectral["low_end_ratio"])
    high = float(spectral["high_ratio"])
    corr = stereo.get("correlation")
    recs = []

    if clipped > 0:
        recs.append({"area": "gain", "action": "reduce_upstream_level", "reason": f"Render contains {clipped} clipped PCM samples."})
    elif headroom < 1.0:
        recs.append({"area": "gain", "action": "restore_headroom", "reason": f"Peak {peak:.2f} dBFS leaves {headroom:.2f} dB headroom."})

    if role not in {"kick", "bass"} and low > 0.45:
        recs.append({"area": "tone", "action": "inspect_unnecessary_low_end", "reason": f"Low-end reference ratio is {low:.3f}."})
    if role in {"kick", "perc"} and crest < 4.0:
        recs.append({"area": "dynamics", "action": "preserve_transient", "reason": f"Crest factor is {crest:.2f} dB."})
    if corr is not None and float(corr) < 0.0:
        recs.append({"area": "stereo", "action": "inspect_phase_before_width", "reason": f"Stereo correlation is {float(corr):.3f}."})
    if role in {"hat", "perc", "motif", "voice"} and high > 0.60:
        recs.append({"area": "tone", "action": "inspect_harshness", "reason": f"Presence+air reference ratio is {high:.3f}."})

    available = []
    if any(r["area"] == "tone" for r in recs):
        available += [d for d in ("EQ Eight", "Auto Filter") if d in devices]
    if any(r["area"] == "dynamics" for r in recs):
        available += [d for d in ("Compressor", "Glue Compressor", "Drum Buss") if d in devices]
    if any(r["area"] == "stereo" for r in recs) and "Utility" in devices:
        available.append("Utility")
    if any(r["area"] == "gain" for r in recs):
        available += [d for d in ("Utility", "Limiter") if d in devices]
    if available:
        recs.append({"area": "routing", "action": "available_devices", "devices": sorted(set(available)), "reason": "Use exact indexed parameters from the processing plan."})
    if not recs:
        recs.append({"area": "review", "action": "audible_ab", "reason": "No obvious measurement risk detected; keep the decision musical."})
    return recs


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a measurement-aware TITAN mix review.")
    parser.add_argument("plan", type=Path)
    parser.add_argument("analysis_dir", type=Path)
    parser.add_argument("--output", type=Path, default=Path("titan-mix-brain-review.json"))
    args = parser.parse_args()

    plan = json.loads(args.plan.read_text(encoding="utf-8-sig"))
    analyses = load_analyses(args.analysis_dir)
    output = {"schema": 1, "mode": "review_only", "targets": []}
    for target in plan.get("targets", []):
        analysis = match(str(target.get("name", "")), analyses)
        devices = {str(d.get("device_name", "")) for d in target.get("devices", [])}
        output["targets"].append({
            "target_kind": target.get("target_kind"),
            "index": target.get("index"),
            "name": target.get("name"),
            "role": target.get("role"),
            "analysis_file": None if analysis is None else analysis.get("analysis_file"),
            "recommendations": assess(str(target.get("role", "other")), analysis, devices),
        })
    args.output.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Wrote TITAN mix review: {args.output}")
    print("Review only: no Ableton parameters were changed.")


if __name__ == "__main__":
    main()
