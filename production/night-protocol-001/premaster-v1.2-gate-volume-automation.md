# Night Protocol 001 — Premaster v1.2 Gate and Volume Automation

Status: **PREMASTER REVIEW — NOT MASTERED**

## Irina feedback implemented

- Added rhythmic gating to the melody.
- Added section-specific gate patterns instead of one repeated tremolo.
- Added volume automation to every stem group across all structural sections.
- Preserved the call-and-response logic introduced in v1.1.

## Gate behavior

- Intro identity: sparse gated statements.
- Intro pulse: wider openings and more rhythmic information.
- Intro launch: denser syncopation before the full groove.
- Groove establishment: restrained 16-step pattern.
- Funk development: increased syncopation and shifted alternate phrases.
- Rupture: melody nearly removed.
- Second development: denser question-and-answer gate interaction.
- Signature climax: most open and energetic gate state.
- Descent: reduced density and declining presence.

Gate smoothing uses approximately 8 ms attack and 28 ms release to avoid clicks.

## Section volume automation

Automation was applied independently to kick, bass, main drums, detail percussion, music, atmosphere, texture, impacts, and returns. The changes emphasize section function rather than applying one master fade:

- Low-end and drums progressively enter through the intro.
- Development sections increase bass, percussion, and musical presence.
- Rupture suppresses kick, bass, drums, and melody while atmosphere and texture rise.
- Climax raises the complete groove and musical dialogue.
- Descent reduces foreground energy while preserving atmosphere and tails.
- Returns follow a partial gate so reverb and delay tails remain natural.

## Technical QC

- Tempo: 124 BPM
- Duration: 5:13.68
- Format: stereo 48 kHz / 24-bit WAV
- Premaster peak: -6.20 dBFS
- Premaster RMS: -26.20 dBFS
- Flat-topped samples: none
- All stems aligned to 15,056,516 frames
- No limiter, saturation, or mastering processing
- Premaster SHA-256: `29c317d8106001740c97585ae4e6f7acdbde06d787ae9e9470cfa8b9c8e1b8a2`

## Decision gate

Irina reviews whether the gate supports groove and whether the volume automation creates clear section progression before mastering begins.
