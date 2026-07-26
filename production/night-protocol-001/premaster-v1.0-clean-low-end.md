# Night Protocol 001 — Premaster v1.0 Clean Low-End Revision

Status: **PREMASTER REVIEW — NOT MASTERED**

## Defect corrected

Irina rejected the v0.9 low end because the kick and bass still sounded saturated. Technical inspection showed no full-scale clipping, but confirmed excessive perceived density from upper harmonics and kick/bass overlap.

## Changes

- Reduced kick source level by approximately 2.2 dB.
- Reduced bass source level by approximately 1.8 dB before sidechain processing.
- Applied a 28 Hz high-pass to both low-end stems.
- Applied a 2.3 kHz low-pass to the kick.
- Applied a 1.5 kHz low-pass to the bass.
- Reduced resonant energy around the kick body and bass low-mid region.
- Rebuilt the kick-to-bass sidechain with moderate ratio and a 155 ms release.
- Preserved all non-low-end stems and the v0.9 arrangement.
- Reconstructed the premaster by replacing only the old kick and bass contributions.
- Used no saturation, clipping, limiting, or mastering processing.

## Technical QC

- Kick peak: approximately -13.0 dBFS
- Bass peak: approximately -15.7 dBFS
- Premaster peak: approximately -9.4 dBFS
- Premaster RMS: approximately -25.7 dBFS
- Flat factor: 0.0 on kick, bass, and premaster
- DC offset: negligible
- Premaster SHA-256: `01d0c0560393a2a610ce17b27b9aa99200d576416a0af7adcd69fc5936b71820`

## Decision gate

Irina reviews whether the low end now sounds clean, controlled, and still sufficiently prominent before any further gain restoration or mastering begins.
