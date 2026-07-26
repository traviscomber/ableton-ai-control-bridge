"""DARKSCO Core Night 001 v0.2 iteration.

Adds family-based synthesis, stereo-safe long assets, and contextual audition loops.
The module remains deterministic and uses only Python's standard library.
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

from darksco_soundbank.generator import (
    BIT_DEPTH,
    MAX_24,
    SAMPLE_RATE,
    _clamp,
    _normalize,
    _peak_dbfs,
    _soft_clip,
    synth_metal_hit,
    synth_night_kick,
    synth_sub_hit,
)


@dataclass(frozen=True)
class CuratedAsset:
    asset_id: str
    family_id: str
    role: str
    state: str
    seed: int
    channels: int
    sample_rate_hz: int
    bit_depth: int
    duration_seconds: float
    peak_dbfs: float
    sha256: str
    source_policy: str
    rights_status: str
    review_status: str
    artist_intent: str


def _encode_24(value: float) -> bytes:
    integer = int(round(_clamp(value) * MAX_24))
    if integer < 0:
        integer += 1 << 24
    return struct.pack("<I", integer)[:3]


def _write_stereo_wav(path: Path, left: list[float], right: list[float]) -> str:
    if len(left) != len(right):
        raise ValueError("stereo channels must have equal length")
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    for left_value, right_value in zip(left, right):
        frames.extend(_encode_24(left_value))
        frames.extend(_encode_24(right_value))
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(3)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_mono_wav(path: Path, samples: list[float]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    for value in samples:
        frames.extend(_encode_24(value))
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(3)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def synth_noise_hat(seed: int, duration: float = 0.24) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    previous = 0.0
    samples: list[float] = []
    decay = rng.uniform(24.0, 42.0)
    metallic_hz = rng.uniform(5700.0, 8900.0)
    for index in range(length):
        time = index / SAMPLE_RATE
        white = rng.uniform(-1.0, 1.0)
        high = white - previous * 0.84
        previous = white
        ring = math.sin(math.tau * metallic_hz * time) * 0.16
        envelope = math.exp(-decay * time)
        samples.append(_soft_clip((high * 0.55 + ring) * envelope, drive=1.6))
    return _normalize(samples, peak=0.68)


def synth_machine_scrape(seed: int, duration: float = 1.8) -> list[float]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    carrier = rng.uniform(160.0, 260.0)
    modulator = rng.uniform(11.0, 31.0)
    low_state = 0.0
    samples: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        noise = rng.uniform(-1.0, 1.0)
        low_state += 0.035 * (noise - low_state)
        sweep = carrier * (0.7 + 1.8 * time / duration)
        phase = math.tau * sweep * time + 4.0 * math.sin(math.tau * modulator * time)
        envelope = math.sin(math.pi * min(1.0, time / duration)) ** 1.6
        value = (0.5 * math.sin(phase) + 0.75 * low_state) * envelope
        samples.append(_soft_clip(value, drive=2.5))
    return _normalize(samples, peak=0.74)


def synth_void_transition(seed: int, duration: float = 4.0) -> tuple[list[float], list[float]]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    left: list[float] = []
    right: list[float] = []
    low_left = 0.0
    low_right = 0.0
    base_hz = rng.uniform(44.0, 58.0)
    for index in range(length):
        time = index / SAMPLE_RATE
        progress = time / duration
        noise_l = rng.uniform(-1.0, 1.0)
        noise_r = rng.uniform(-1.0, 1.0)
        low_left += 0.004 * (noise_l - low_left)
        low_right += 0.004 * (noise_r - low_right)
        mono_low = math.sin(math.tau * base_hz * time) * (1.0 - progress) * 0.35
        width = math.sin(math.pi * progress)
        left_value = mono_low + low_left * width * 0.7
        right_value = mono_low + low_right * width * 0.7
        fade = math.sin(math.pi * progress) ** 0.7
        left.append(_soft_clip(left_value * fade, drive=1.5))
        right.append(_soft_clip(right_value * fade, drive=1.5))
    peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
    scale = 0.66 / peak
    return ([x * scale for x in left], [x * scale for x in right])


def synth_stereo_drone(seed: int, duration: float = 12.0) -> tuple[list[float], list[float]]:
    rng = random.Random(seed)
    length = int(SAMPLE_RATE * duration)
    partials = [rng.uniform(51.0, 180.0) for _ in range(6)]
    phases = [rng.uniform(0.0, math.tau) for _ in partials]
    left: list[float] = []
    right: list[float] = []
    for index in range(length):
        time = index / SAMPLE_RATE
        mono_low = math.sin(math.tau * partials[0] * time + phases[0]) * 0.28
        left_air = 0.0
        right_air = 0.0
        for position, (frequency, phase) in enumerate(zip(partials[1:], phases[1:]), start=1):
            drift = math.sin(time * (0.025 + position * 0.011)) * 0.75
            left_air += math.sin(math.tau * frequency * time + phase + drift) / (position + 2)
            right_air += math.sin(math.tau * frequency * time + phase - drift) / (position + 2)
        movement = 0.58 + 0.42 * math.sin(math.tau * 0.028 * time + 0.4)
        edge = min(1.0, time * 1.2, (duration - time) * 1.2)
        left.append(_soft_clip((mono_low + left_air * 0.45) * movement * edge, drive=1.2))
        right.append(_soft_clip((mono_low + right_air * 0.45) * movement * edge, drive=1.2))
    peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
    scale = 0.58 / peak
    return ([x * scale for x in left], [x * scale for x in right])


def _place(target: list[float], source: list[float], start: int, gain: float) -> None:
    for offset, sample in enumerate(source):
        index = start + offset
        if index >= len(target):
            break
        target[index] += sample * gain


def render_audition_loop(seed: int, bpm: float = 136.0, bars: int = 8) -> list[float]:
    if bpm <= 0 or bars < 1:
        raise ValueError("invalid audition loop settings")
    seconds_per_beat = 60.0 / bpm
    total_seconds = seconds_per_beat * 4.0 * bars
    output = [0.0] * int(total_seconds * SAMPLE_RATE)
    kick = synth_night_kick(seed)
    sub = synth_sub_hit(seed + 1)
    metal = synth_metal_hit(seed + 2)
    hat = synth_noise_hat(seed + 3)
    samples_per_beat = int(seconds_per_beat * SAMPLE_RATE)
    for beat in range(bars * 4):
        start = beat * samples_per_beat
        _place(output, kick, start, 0.74)
        if beat % 4 in (0, 2):
            _place(output, sub, start, 0.50)
        if beat % 2 == 1:
            _place(output, metal, start + samples_per_beat // 2, 0.26)
        _place(output, hat, start + samples_per_beat // 2, 0.20)
    return _normalize([_soft_clip(value, drive=1.25) for value in output], peak=0.72)


def build_iteration(output_dir: Path, seed: int = 22000) -> list[CuratedAsset]:
    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[CuratedAsset] = []

    mono_specs = [
        ("hat", "percussion-air", "night-hat-family", synth_noise_hat, "Controlled high-frequency movement without brittle brightness."),
        ("scrape", "texture-machine", "night-machine-family", synth_machine_scrape, "Mechanical tension source for transitions and signature events."),
    ]
    for family_index, (name, role, family, generator, intent) in enumerate(mono_specs):
        for variant in range(4):
            asset_seed = seed + family_index * 1000 + variant
            samples = generator(asset_seed)
            asset_id = f"darksco_night_{name}_{variant + 1:03d}"
            path = output_dir / role / f"{asset_id}.wav"
            digest = _write_mono_wav(path, samples)
            records.append(CuratedAsset(
                asset_id=asset_id,
                family_id=family,
                role=role,
                state="night",
                seed=asset_seed,
                channels=1,
                sample_rate_hz=SAMPLE_RATE,
                bit_depth=BIT_DEPTH,
                duration_seconds=round(len(samples) / SAMPLE_RATE, 6),
                peak_dbfs=round(_peak_dbfs(samples), 3),
                sha256=digest,
                source_policy="original_synthesis_only",
                rights_status="cleared",
                review_status="candidate",
                artist_intent=intent,
            ))

    stereo_specs = [
        ("void_transition", "transition-stereo", "night-void-family", synth_void_transition, "Create a controlled loss of scale before the groove returns."),
        ("drone", "atmosphere-stereo", "night-drone-family", synth_stereo_drone, "Provide deep space with mono-safe low-frequency content."),
    ]
    for family_index, (name, role, family, generator, intent) in enumerate(stereo_specs, start=2):
        for variant in range(3):
            asset_seed = seed + family_index * 1000 + variant
            left, right = generator(asset_seed)
            asset_id = f"darksco_night_{name}_{variant + 1:03d}"
            path = output_dir / role / f"{asset_id}.wav"
            digest = _write_stereo_wav(path, left, right)
            peak = max(_peak_dbfs(left), _peak_dbfs(right))
            records.append(CuratedAsset(
                asset_id=asset_id,
                family_id=family,
                role=role,
                state="night",
                seed=asset_seed,
                channels=2,
                sample_rate_hz=SAMPLE_RATE,
                bit_depth=BIT_DEPTH,
                duration_seconds=round(len(left) / SAMPLE_RATE, 6),
                peak_dbfs=round(peak, 3),
                sha256=digest,
                source_policy="original_synthesis_only",
                rights_status="cleared",
                review_status="candidate",
                artist_intent=intent,
            ))

    audition = render_audition_loop(seed + 9000)
    audition_id = "darksco_night_audition_loop_001"
    audition_path = output_dir / "audition" / f"{audition_id}.wav"
    audition_digest = _write_mono_wav(audition_path, audition)
    records.append(CuratedAsset(
        asset_id=audition_id,
        family_id="night-context-preview",
        role="audition-loop",
        state="night",
        seed=seed + 9000,
        channels=1,
        sample_rate_hz=SAMPLE_RATE,
        bit_depth=BIT_DEPTH,
        duration_seconds=round(len(audition) / SAMPLE_RATE, 6),
        peak_dbfs=round(_peak_dbfs(audition), 3),
        sha256=audition_digest,
        source_policy="original_synthesis_only",
        rights_status="cleared",
        review_status="context_only",
        artist_intent="Audition core transient families in a restrained eight-bar groove.",
    ))

    manifest = {
        "schema": "darksco.soundbank/1.1",
        "library": "DARKSCO Core Night 001",
        "iteration": "0.2",
        "decision_owner": "Irina",
        "curation_policy": {
            "candidate": "Not approved for official library use until contextual listening review.",
            "approved": "Accepted by Artist, Venom, and Irina.",
            "rejected": "Preserved in evidence but excluded from production indexes.",
        },
        "assets": [asdict(record) for record in records],
    }
    (output_dir / "manifest-v0.2.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate DARKSCO Core Night 001 v0.2")
    parser.add_argument("output", type=Path)
    parser.add_argument("--seed", type=int, default=22000)
    args = parser.parse_args()
    records = build_iteration(args.output, seed=args.seed)
    print(f"Generated {len(records)} v0.2 assets in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
