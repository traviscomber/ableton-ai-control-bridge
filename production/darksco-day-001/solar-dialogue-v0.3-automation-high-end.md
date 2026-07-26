# DARKSCO Day 001 — Solar Dialogue v0.3

Status: **PREMASTER REVIEW — NOT MASTERED**

## Irina feedback implemented

- Added independent section-level gain automation to every delivered track group.
- Music gain now rises and falls through intro, groove establishment, development, rupture, second development, climax, and outro.
- Split the former combined detail stem into separate percussion and hats/shaker stems.
- Treated drum body and hats independently.
- Reduced brittle high-frequency energy across hats, drums, atmosphere, impacts, returns, and music.
- Preserved the intro melody glimpse and isolated four-second ending.

## Automation method

This package contains rendered automation-equivalent curves. It does not contain an Ableton Live Set and therefore does not claim visible runtime automation lanes.

Ultron recommendation for the Ableton session:

- Place Utility on each track.
- Automate Utility Gain for arrangement movement.
- Leave channel faders available for final balance.
- Keep hats, percussion, main drums, music, pads, bass, atmosphere, impacts, and returns on separate tracks.

## High-end correction

- Main drums low-pass ceiling: approximately 11.2 kHz.
- Hats/shaker high-pass separation: approximately 4.3 kHz.
- Hats/shaker low-pass ceiling: approximately 11.3 kHz.
- Hats/shaker source gain reduced before section automation.
- Percussion body retained below approximately 6.2 kHz.
- Atmosphere and returns received separate high-frequency attenuation.
- Music received a gentler high-frequency ceiling to preserve melody and pads.

## Technical QC

- Tempo: 122 BPM
- Duration: 5:21.75
- Format: stereo 48 kHz / 24-bit WAV
- Premaster peak: -6.20 dBFS
- Premaster RMS: -22.74 dBFS
- High-frequency energy ratio above 10 kHz reduced from approximately 0.00923 to 0.00038 in sampled analysis windows.
- All stems aligned to 15,444,197 frames.
- Stem reconstruction error: zero after final PCM export.
- No limiter, clipper, or saturation.
- Premaster SHA-256: `76e088b6fbf2be167ded02515d5f9fea500b50857bd5b0997205b3039aa240c8`

## Decision gate

Irina reviews whether the hats are now controlled without becoming dull, whether drum hits remain distinct, and whether the per-track gain movement creates the intended section progression.
