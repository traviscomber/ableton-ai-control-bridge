"""Deterministic, dependency-free DARKSCO soundbank synthesis.

The generator creates original PCM WAV assets and provenance manifests using only
Python's standard library. It is intended as the first reproducible source layer
for the DARKSCO Artist pipeline, not as a finished mastering stage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import struct
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Iterable

SAMPLE_RATE = 48_000
BIT_DEPTH = 24
MAX_24 = (1 << 23) - 1


@dataclass(frozen=True)
class AssetRecord:
    asset_id: str
    category: str
    state: str
    seed: int
    sample_rate_hz: int
    bit_depth: int
    duration_seconds: float
    peak_dbfs: float
    sha256: str
    generator: str
    source_policy: str = "original_synthesis"
    rights_status: str = "cleared"


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _soft_clip(value: float, drive: float = 1.0) -> float:
    if drive <= 0:
        raise ValueError("drive must be positive")
    normalizer = math.tanh(drive)
    return math.tanh(value * drive) / normalizer


def _normalize(samples: list[float], peak: float = 0.82) -> list[float]:
    if not samples:
        raise ValueError("samples cannot be empty")
    maximum = max(abs(sample) for sample in samples)
    if maximum == 0:
        raise ValueError("refusing to normalize silent output")
    scale = peak / maximum
    return [_clamp(sample * scale) for sample in samples]


def _peak_dbfs(samples: Iterable[float]) -> float:
    peak = max(abs(sample) for sample in samples)
    return -120.0 if peak == 0 else 20.0 * math.log10(peak)


def _write_wav_24(path: Path, samples: list[float], sample_rate: int) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    for sample in samples:
        value = int(round(_clamp(sample) * MAX_24))
        if value < 0:
            value += 1 << 24
        frames.extend(struct.pack("<I", value)[:3])
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(3)
        handle.setframerate(sample_rate)
        handle.writeframes(bytes(frames))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def synth_night_kick(seed: int, duration: float = 0.72) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    start_hz = rng.uniform(120.0, 165.0)
    body_hz = rng.uniform(42.0, 51.0)
    pitch_decay = rng.uniform(22.0, 34.0)
    amp_decay = rng.uniform(8.0, 12.0)
    click_level = rng.uniform(0.05, 0.11)
    phase = 0.0
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        frequency = body_hz + (start_hz - body_hz) * math.exp(-pitch_decay * time)
        phase += 2.0 * math.pi * frequency / SAMPLE_RATE
        body = math.sin(phase) * math.exp(-amp_decay * time)
        click = rng.uniform(-1.0, 1.0) * math.exp(-95.0 * time) * click_level
        samples.append(_soft_clip(body + click, drive=1.8))
    return _normalize(samples, peak=0.86)


def synth_sub_hit(seed: int, duration: float = 1.25) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    base_hz = rng.choice([41.20, 43.65, 46.25, 49.00, 51.91])
    decay = rng.uniform(2.5, 4.2)
    phase = 0.0
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        phase += 2.0 * math.pi * base_hz / SAMPLE_RATE
        fundamental = math.sin(phase)
        harmonic = 0.18 * math.sin(2.0 * phase + 0.3)
        envelope = (1.0 - math.exp(-55.0 * time)) * math.exp(-decay * time)
        samples.append(_soft_clip((fundamental + harmonic) * envelope, drive=1.3))
    return _normalize(samples, peak=0.78)


def synth_metal_hit(seed: int, duration: float = 0.48) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    frequencies = [rng.uniform(370.0, 730.0) * ratio for ratio in (1.0, 1.37, 1.91, 2.63)]
    phases = [rng.uniform(0.0, math.tau) for _ in frequencies]
    decay = rng.uniform(10.0, 17.0)
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        tone = sum(
            math.sin(math.tau * frequency * time + phase) / (position + 1)
            for position, (frequency, phase) in enumerate(zip(frequencies, phases))
        )
        noise = rng.uniform(-1.0, 1.0) * math.exp(-45.0 * time) * 0.25
        envelope = math.exp(-decay * time)
        samples.append(_soft_clip(tone * envelope * 0.55 + noise, drive=2.2))
    return _normalize(samples, peak=0.80)


def synth_impact(seed: int, duration: float = 2.8) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    low_hz = rng.uniform(31.0, 39.0)
    samples: list[float] = []
    low_state = 0.0
    for index in range(length):
        time = index / SAMPLE_RATE
        noise = rng.uniform(-1.0, 1.0)
        low_state += 0.015 * (noise - low_state)
        boom = math.sin(math.tau * low_hz * time + 0.15 * math.sin(3.0 * time))
        envelope = math.exp(-1.9 * time)
        attack = min(1.0, time * 45.0)
        samples.append(_soft_clip((0.72 * boom + 0.55 * low_state) * envelope * attack, drive=1.7))
    return _normalize(samples, peak=0.84)


def synth_atmosphere(seed: int, duration: float = 8.0) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    partials = [rng.uniform(47.0, 220.0) for _ in range(7)]
    phases = [rng.uniform(0.0, math.tau) for _ in partials]
    drift = [rng.uniform(0.015, 0.09) for _ in partials]
    low_state = 0.0
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        noise = rng.uniform(-1.0, 1.0)
        low_state += 0.0025 * (noise - low_state)
        bed = sum(
            math.sin(math.tau * frequency * time + phase + math.sin(time * rate) * 0.55)
            / (position + 2)
            for position, (frequency, phase, rate) in enumerate(zip(partials, phases, drift))
        )
        movement = 0.52 + 0.48 * math.sin(math.tau * 0.035 * time + 0.7)
        edge_fade = min(1.0, time * 1.5, (duration - time) * 1.5)
        samples.append(_soft_clip((bed * 0.38 + low_state * 0.55) * movement * edge_fade, drive=1.2))
    return _normalize(samples, peak=0.62)


GENERATORS: dict[str, tuple[str, Callable[[int], list[float]]]] = {
    "night_kick": ("kick", synth_night_kick),
    "sub_hit": ("bass", synth_sub_hit),
    "metal_hit": ("percussion", synth_metal_hit),
    "impact": ("impact", synth_impact),
    "atmosphere": ("atmosphere", synth_atmosphere),
}


def generate_library(output_dir: Path, count: int = 4, seed: int = 1000) -> list[AssetRecord]:
    if count < 1:
        raise ValueError("count must be at least one")
    records: list[AssetRecord] = []
    for generator_index, (name, (category, generator)) in enumerate(GENERATORS.items()):
        category_dir = output_dir / category
        for variant in range(count):
            asset_seed = seed + generator_index * 10_000 + variant
            asset_id = f"darksco_night_{name}_{variant + 1:03d}"
            samples = generator(asset_seed)
            path = category_dir / f"{asset_id}.wav"
            digest = _write_wav_24(path, samples, SAMPLE_RATE)
            records.append(
                AssetRecord(
                    asset_id=asset_id,
                    category=category,
                    state="night",
                    seed=asset_seed,
                    sample_rate_hz=SAMPLE_RATE,
                    bit_depth=BIT_DEPTH,
                    duration_seconds=round(len(samples) / SAMPLE_RATE, 6),
                    peak_dbfs=round(_peak_dbfs(samples), 3),
                    sha256=digest,
                    generator=name,
                )
            )
    manifest = {
        "schema": "darksco.soundbank/1.0",
        "library": "DARKSCO Core Night 001",
        "source_policy": "original_synthesis_only",
        "decision_owner": "Irina",
        "asset_count": len(records),
        "assets": [asdict(record) for record in records],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the DARKSCO Core Night soundbank")
    parser.add_argument("output", type=Path, help="Output directory")
    parser.add_argument("--count", type=int, default=4, help="Variants per generator")
    parser.add_argument("--seed", type=int, default=1000, help="Base deterministic seed")
    args = parser.parse_args()
    records = generate_library(args.output, count=args.count, seed=args.seed)
    print(f"Generated {len(records)} assets in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
