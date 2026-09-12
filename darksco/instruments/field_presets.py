from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Mapping

from .field import FIELD_CONTROLS, compile_field_state


@dataclass(frozen=True)
class FieldPreset:
    name: str
    controls: Mapping[str, float]


FIELD_PRESETS: dict[str, FieldPreset] = {
    "morning": FieldPreset(
        "Morning",
        {
            "density": 0.28,
            "spread": 0.78,
            "motion": 0.22,
            "instability": 0.10,
            "texture": 0.24,
            "space": 0.68,
        },
    ),
    "noon": FieldPreset(
        "Noon",
        {
            "density": 0.52,
            "spread": 0.62,
            "motion": 0.40,
            "instability": 0.18,
            "texture": 0.38,
            "space": 0.46,
        },
    ),
    "night": FieldPreset(
        "Night",
        {
            "density": 0.72,
            "spread": 0.70,
            "motion": 0.31,
            "instability": 0.32,
            "texture": 0.58,
            "space": 0.74,
        },
    ),
}


# Per-control perturbation radius. Randomization deliberately stays musical:
# it varies a preset without erasing its macro identity.
FIELD_RANDOM_RADIUS: dict[str, float] = {
    "density": 0.12,
    "spread": 0.10,
    "motion": 0.14,
    "instability": 0.10,
    "texture": 0.12,
    "space": 0.10,
}


def get_field_preset(name: str) -> FieldPreset:
    key = name.strip().lower()
    try:
        return FIELD_PRESETS[key]
    except KeyError as exc:
        raise ValueError(f"Unknown FIELD preset: {name}") from exc


def randomize_field_controls(
    base: Mapping[str, float],
    *,
    seed: int,
    amount: float = 1.0,
) -> dict[str, float]:
    """Return a deterministic bounded variation of a valid FIELD state."""
    if not 0.0 <= amount <= 1.0:
        raise ValueError("amount must be between 0 and 1.")
    if set(base) != set(FIELD_CONTROLS):
        raise ValueError("base must define exactly the six FIELD controls.")

    rng = Random(seed)
    randomized: dict[str, float] = {}
    for control in FIELD_CONTROLS:
        value = float(base[control])
        radius = FIELD_RANDOM_RADIUS[control] * amount
        delta = rng.uniform(-radius, radius)
        randomized[control] = round(min(1.0, max(0.0, value + delta)), 6)
    return randomized


def compile_field_preset(
    preset: str,
    *,
    track: int | None = None,
    track_ref: str | None = None,
    seed: int | None = None,
    variation: float = 0.0,
):
    selected = get_field_preset(preset)
    controls = dict(selected.controls)
    if seed is not None or variation:
        if seed is None:
            raise ValueError("seed is required when variation is non-zero.")
        controls = randomize_field_controls(controls, seed=seed, amount=variation)
    return compile_field_state(controls, track=track, track_ref=track_ref)
