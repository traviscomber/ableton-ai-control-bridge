from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .field import FIELD_CONTROLS, compile_field_state
from .field_presets import get_field_preset


@dataclass(frozen=True)
class FieldIntent:
    preset: str
    modifiers: Mapping[str, float]


# Semantic words map to conservative additive deltas in normalized space.
# The resolver never changes the public bridge contract and never emits values
# outside 0..1.
FIELD_INTENT_DELTAS: dict[str, dict[str, float]] = {
    "deeper": {"density": 0.10, "texture": 0.08, "space": 0.06},
    "lighter": {"density": -0.10, "texture": -0.08},
    "darker": {"texture": 0.10, "instability": 0.04, "density": 0.04},
    "cleaner": {"texture": -0.12, "instability": -0.08},
    "wider": {"spread": 0.12, "space": 0.05},
    "narrower": {"spread": -0.12},
    "more_motion": {"motion": 0.12},
    "less_motion": {"motion": -0.12},
    "more_space": {"space": 0.12},
    "less_space": {"space": -0.12},
    "more_unstable": {"instability": 0.12},
    "more_stable": {"instability": -0.12},
}


def resolve_field_intent(intent: FieldIntent) -> dict[str, float]:
    controls = dict(get_field_preset(intent.preset).controls)

    unknown = sorted(set(intent.modifiers) - set(FIELD_INTENT_DELTAS))
    if unknown:
        raise ValueError(f"Unknown FIELD intent modifier(s): {', '.join(unknown)}")

    for modifier, strength in intent.modifiers.items():
        if isinstance(strength, bool) or not isinstance(strength, (int, float)):
            raise ValueError(f"{modifier} strength must be a number between 0 and 1.")
        strength = float(strength)
        if not 0.0 <= strength <= 1.0:
            raise ValueError(f"{modifier} strength must be between 0 and 1.")
        for control, delta in FIELD_INTENT_DELTAS[modifier].items():
            controls[control] = round(min(1.0, max(0.0, controls[control] + delta * strength)), 6)

    if set(controls) != set(FIELD_CONTROLS):
        raise ValueError("Resolved FIELD intent must contain exactly the six FIELD controls.")
    return controls


def compile_field_intent(
    intent: FieldIntent,
    *,
    track: int | None = None,
    track_ref: str | None = None,
):
    return compile_field_state(resolve_field_intent(intent), track=track, track_ref=track_ref)


def parse_field_phrase(phrase: str, *, default_preset: str = "night") -> FieldIntent:
    """Parse a deliberately small, deterministic musical phrase vocabulary.

    Natural-language AI can produce FieldIntent directly. This parser is a
    predictable fallback for local/offline control; it is not intended to be a
    general NLP system.
    """
    text = " ".join(phrase.lower().replace(",", " ").split())
    preset = default_preset
    for candidate in ("morning", "noon", "night"):
        if candidate in text:
            preset = candidate
            break

    phrases = {
        "deeper": "deeper",
        "deep": "deeper",
        "lighter": "lighter",
        "light": "lighter",
        "darker": "darker",
        "dark": "darker",
        "cleaner": "cleaner",
        "clean": "cleaner",
        "wider": "wider",
        "wide": "wider",
        "narrower": "narrower",
        "narrow": "narrower",
        "more motion": "more_motion",
        "less motion": "less_motion",
        "more space": "more_space",
        "less space": "less_space",
        "more unstable": "more_unstable",
        "more stable": "more_stable",
    }

    modifiers: dict[str, float] = {}
    # Match multi-word phrases before single-word aliases to avoid collisions.
    for token, modifier in sorted(phrases.items(), key=lambda item: len(item[0]), reverse=True):
        if token in text:
            modifiers[modifier] = 1.0

    return FieldIntent(preset=preset, modifiers=modifiers)
