from __future__ import annotations

import argparse
import json
import math
import wave
from array import array
from pathlib import Path
from typing import Iterable

EPS = 1e-12
BAND_CENTERS = {
    "sub": (40.0, 55.0, 70.0, 90.0),
    "bass": (120.0, 160.0, 220.0),
    "low_mid": (300.0, 450.0, 650.0),
    "mid": (900.0, 1400.0, 2200.0),
    "presence": (3200.0, 4500.0, 6000.0),
    "air": (8000.0, 10000.0, 12000.0),
}


def _db(value: float) -> float:
    if value <= EPS:
        return -120.0
    return 20.0 * math.log10(value)


def _decode_pcm(raw: bytes, sample_width: int) -> list[int]:
    if sample_width == 1:
        return [b - 128 for b in raw]
    if sample_width == 2:
        samples = array("h")
        samples.frombytes(raw)
        if samples.itemsize != 2:
            raise ValueError("Unexpected 16-bit sample width")
        return samples.tolist()
    if sample_width == 3:
        out: list[int] = []
        for i in range(0, len(raw), 3):
            chunk = raw[i : i + 3]
            if len(chunk) < 3:
                break
            value = chunk[0] | (chunk[1] << 8) | (chunk[2] << 16)
            if value & 0x800000:
                value -= 1 << 24
            out.append(value)
        return out
    if sample_width == 4:
        samples = array("i")
        samples.frombytes(raw)
        if samples.itemsize != 4:
            raise ValueError("Unexpected 32-bit sample width")
        return samples.tolist()
    raise ValueError(f"Unsupported PCM sample width: {sample_width} bytes")


def _normalize(samples: Iterable[int], sample_width: int) -> list[float]:
    scale = float(1 << (sample_width * 8 - 1))
    return [max(-1.0, min(1.0, s / scale)) for s in samples]


def _channelize(samples: list[float], channels: int) -> list[list[float]]:
    return [samples[ch::channels] for ch in range(channels)]


def _stats(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"peak_linear": 0.0, "peak_dbfs": -120.0, "rms_linear": 0.0, "rms_dbfs": -120.0, "dc_offset": 0.0, "clipped_samples": 0}
    peak = max(abs(v) for v in values)
    mean_square = sum(v * v for v in values) / len(values)
    rms = math.sqrt(mean_square)
    dc = sum(values) / len(values)
    clipped = sum(1 for v in values if abs(v) >= 0.9999)
    return {
        "peak_linear": peak,
        "peak_dbfs": _db(peak),
        "rms_linear": rms,
        "rms_dbfs": _db(rms),
        "dc_offset": dc,
        "clipped_samples": clipped,
    }


def _stereo_correlation(left: list[float], right: list[float]) -> float | None:
    n = min(len(left), len(right))
    if n < 2:
        return None
    left = left[:n]
    right = right[:n]
    ml = sum(left) / n
    mr = sum(right) / n
    num = 0.0
    dl2 = 0.0
    dr2 = 0.0
    for l, r in zip(left, right):
        dl = l - ml
        dr = r - mr
        num += dl * dr
        dl2 += dl * dl
        dr2 += dr * dr
    denom = math.sqrt(dl2 * dr2)
    if denom <= EPS:
        return 0.0
    return max(-1.0, min(1.0, num / denom))


def _goertzel_power(values: list[float], sample_rate: int, frequency: float) -> float:
    if not values or frequency <= 0 or frequency >= sample_rate / 2:
        return 0.0
    omega = 2.0 * math.pi * frequency / sample_rate
    coeff = 2.0 * math.cos(omega)
    s_prev = 0.0
    s_prev2 = 0.0
    for x in values:
        s = x + coeff * s_prev - s_prev2
        s_prev2 = s_prev
        s_prev = s
    power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2
    return max(0.0, power / max(1, len(values) ** 2))


def _spectral_bands(mono: list[float], sample_rate: int, max_frames: int = 262144) -> dict[str, float]:
    if not mono:
        return {name: 0.0 for name in BAND_CENTERS}
    if len(mono) > max_frames:
        windows = 4
        size = max_frames // windows
        starts = [int((len(mono) - size) * i / max(1, windows - 1)) for i in range(windows)]
        analysis = []
        for start in starts:
            analysis.extend(mono[start : start + size])
    else:
        analysis = mono

    powers: dict[str, float] = {}
    for band, centers in BAND_CENTERS.items():
        valid = [f for f in centers if f < sample_rate / 2]
        if not valid:
            powers[band] = 0.0
            continue
        powers[band] = sum(_goertzel_power(analysis, sample_rate, f) for f in valid) / len(valid)

    total = sum(powers.values())
    if total <= EPS:
        return {name: 0.0 for name in powers}
    return {name: value / total for name, value in powers.items()}


def analyze_wav(path: str | Path) -> dict:
    wav_path = Path(path)
    with wave.open(str(wav_path), "rb") as handle:
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        sample_rate = handle.getframerate()
        frames = handle.getnframes()
        comptype = handle.getcomptype()
        if comptype != "NONE":
            raise ValueError(f"Compressed WAV is not supported: {comptype}")
        raw = handle.readframes(frames)

    decoded = _decode_pcm(raw, sample_width)
    normalized = _normalize(decoded, sample_width)
    per_channel = _channelize(normalized, channels)
    mono = [sum(frame) / channels for frame in zip(*per_channel)] if channels > 1 else per_channel[0]

    global_stats = _stats(normalized)
    channel_stats = [_stats(values) for values in per_channel]
    peak_dbfs = float(global_stats["peak_dbfs"])
    rms_dbfs = float(global_stats["rms_dbfs"])
    correlation = _stereo_correlation(per_channel[0], per_channel[1]) if channels >= 2 else None
    bands = _spectral_bands(mono, sample_rate)

    analysis = {
        "schema": 1,
        "path": str(wav_path),
        "format": {
            "channels": channels,
            "sample_rate": sample_rate,
            "sample_width_bits": sample_width * 8,
            "frames": frames,
            "duration_seconds": frames / sample_rate if sample_rate else 0.0,
        },
        "level": {
            **global_stats,
            "headroom_db": max(0.0, -peak_dbfs),
            "crest_db": peak_dbfs - rms_dbfs,
        },
        "channels": channel_stats,
        "stereo": {
            "correlation": correlation,
            "mono_compatible": None if correlation is None else correlation >= 0.0,
        },
        "spectral_balance": {
            "method": "goertzel_reference_bands",
            "ratios": bands,
            "low_end_ratio": bands.get("sub", 0.0) + bands.get("bass", 0.0),
            "mid_ratio": bands.get("low_mid", 0.0) + bands.get("mid", 0.0),
            "high_ratio": bands.get("presence", 0.0) + bands.get("air", 0.0),
        },
        "limits": {
            "true_peak": "not_measured",
            "lufs": "not_measured",
            "note": "PCM amplitude metrics and sampled reference-band energy only; do not treat as LUFS or true-peak measurement.",
        },
    }
    return analysis


def compare_analyses(before: dict, after: dict) -> dict:
    blevel = before["level"]
    alevel = after["level"]
    bs = before["spectral_balance"]
    ass = after["spectral_balance"]
    bc = before.get("stereo", {}).get("correlation")
    ac = after.get("stereo", {}).get("correlation")

    warnings: list[str] = []
    if alevel["clipped_samples"] > blevel["clipped_samples"]:
        warnings.append("clipping_increased")
    if alevel["headroom_db"] < 0.5:
        warnings.append("headroom_below_0_5_db")
    if ac is not None and ac < 0:
        warnings.append("negative_stereo_correlation")
    if ass["low_end_ratio"] > bs["low_end_ratio"] * 1.35 and ass["low_end_ratio"] > 0.45:
        warnings.append("low_end_energy_increased_materially")

    return {
        "schema": 1,
        "before": before.get("path"),
        "after": after.get("path"),
        "delta": {
            "peak_db": alevel["peak_dbfs"] - blevel["peak_dbfs"],
            "rms_db": alevel["rms_dbfs"] - blevel["rms_dbfs"],
            "crest_db": alevel["crest_db"] - blevel["crest_db"],
            "headroom_db": alevel["headroom_db"] - blevel["headroom_db"],
            "low_end_ratio": ass["low_end_ratio"] - bs["low_end_ratio"],
            "mid_ratio": ass["mid_ratio"] - bs["mid_ratio"],
            "high_ratio": ass["high_ratio"] - bs["high_ratio"],
            "stereo_correlation": None if bc is None or ac is None else ac - bc,
            "clipped_samples": alevel["clipped_samples"] - blevel["clipped_samples"],
        },
        "warnings": warnings,
        "decision": "review_required",
        "note": "No automatic musical quality verdict is produced. Use these measurements together with audible A/B.",
    }


def _write_json(payload: dict, output: Path | None) -> None:
    text = json.dumps(payload, indent=2)
    if output:
        output.write_text(text, encoding="utf-8")
    else:
        print(text)


def main() -> None:
    parser = argparse.ArgumentParser(description="TITAN offline WAV analysis for mix decisions.")
    sub = parser.add_subparsers(dest="command", required=True)

    analyze = sub.add_parser("analyze", help="Analyze one PCM WAV file.")
    analyze.add_argument("wav", type=Path)
    analyze.add_argument("--output", type=Path)

    compare = sub.add_parser("compare", help="Compare two PCM WAV files without declaring a musical winner.")
    compare.add_argument("before", type=Path)
    compare.add_argument("after", type=Path)
    compare.add_argument("--output", type=Path)

    args = parser.parse_args()
    if args.command == "analyze":
        _write_json(analyze_wav(args.wav), args.output)
        return

    before = analyze_wav(args.before)
    after = analyze_wav(args.after)
    _write_json(compare_analyses(before, after), args.output)


if __name__ == "__main__":
    main()
