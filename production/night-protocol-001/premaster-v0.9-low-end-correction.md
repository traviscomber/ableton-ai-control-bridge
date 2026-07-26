# Night Protocol 001 — Premaster v0.9 Low-End Correction

Status: **PREMASTER REVIEW — NOT MASTERED**

## Defect corrected

The v0.8 bass stem contained hard note-boundary discontinuities that produced audible clicks or clipping-like low-end artifacts despite the premaster having adequate peak headroom.

## Changes

- Replaced hard note cuts with 4 ms attack ramps and 14 ms release ramps.
- Removed subsonic drift and DC offset with a 20 Hz high-pass stage.
- Smoothed the kick-triggered sidechain envelope.
- Limited the additional sidechain depth to approximately 3 dB.
- Added 1.2 dB bass prominence compensation between kick events.
- Preserved the v0.8 arrangement and all non-bass stems.
- Reconstructed the premaster from the aligned stem package.
- Used no limiter or mastering processing.

## Technical QC

- Sample rate: 48 kHz
- Bit depth: 24-bit
- Duration: 5:13.68
- Bass peak: -13.0 dBFS
- Premaster peak: -6.2 dBFS
- Bass maximum adjacent-sample jump: 0.003577
- Previous maximum adjacent-sample jump: approximately 0.153
- Bass DC offset: negligible
- Premaster SHA-256: `4aaa6060e4e723c3c091c44e16d14eec9bbf2206707fcbbd0e36eccffcfe148d`

## Decision gate

Irina reviews the corrected low end before mastering begins.
