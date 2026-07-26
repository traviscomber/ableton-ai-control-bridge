# Night Protocol 001 — Premaster v0.6 Kick Revision

Status: **PREMASTER REVIEW — NOT MASTERED**

## Defects corrected

The v0.5 kick was rejected because it sounded over-saturated, retained excessive high-frequency content, and lacked sufficient pattern variation and transition movement.

## Changes

- Replaced the kick source entirely.
- Removed waveshaping, clipping, and saturation from the kick design.
- Applied approximately 24 Hz high-pass and 3.4 kHz low-pass filtering.
- Smoothed the first 3 ms of the transient to remove the digital spike while retaining punch.
- Kept the kick fully dry: no delay, reverb, or return sends.
- Added phrase-aware kick families:
  - sparse half-time
  - straight four-on-the-floor
  - anticipated patterns
  - broken patterns
  - doubles
  - transition rolls
  - stable momentum pattern
- Added controlled transition rolls at bars 31, 63, 79, 111, 127, 167, 183, and 207.
- Added anticipations in the bars immediately preceding those transitions.
- Preserved the straight 4x4 momentum section from bars 184–208, with restrained end-of-phrase doubles.

## Technical

- Tempo: 136 BPM
- Length: 224 bars / 6:35.29
- Format: stereo 48 kHz / 24-bit WAV
- Premaster peak: -6.2 dBFS
- Premaster RMS: -26.44 dBFS
- Master limiter: none
- Premaster SHA-256: `45d208d5c5559d004030f9f822889c954f9043ffc3ad6506614593f6739873c7`

## Artist perspective

The kick now has less artificial aggression and more arrangement responsibility. Its role changes by section instead of repeating one identical four-beat loop. The key listening questions are whether the body remains powerful without saturation, whether the roll density feels deliberate, and whether the transition patterns create momentum without turning into decorative fills.

## Venom perspective

The kick should remain physically stable during the momentum section and become less predictable only where the arrangement needs directional force. If the transition rolls draw attention away from the main groove, reduce them rather than increasing complexity.

## Decision gate

Irina reviews v0.6 before any mastering stage begins.
