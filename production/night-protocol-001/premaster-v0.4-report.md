# Night Protocol 001 — Premaster Mix v0.4

Status: **PREMASTER REVIEW — NOT MASTERED**

## Irina revision implemented

The v0.3 production mix was rebuilt before mastering with role-based gain staging and a structured spatial-effects system.

### Gain staging

Each stem now has a role-specific level instead of equal channel treatment. The premaster was trimmed after summing to preserve mastering headroom.

- Premaster peak: **-6.3 dBFS**
- Premaster RMS: **-22.22 dBFS**
- Master limiter: **none**
- Premaster SHA-256: `f1c235e68f5b466d1330a42d10a103d0191a14476a834ee3404f4043f1b8e7b6`

### Spatial returns

Four independent return stems were created:

1. Rhythmic delay
2. Short reverb
3. Medium reverb
4. Long reverb

Kick and bass remain dry. No delay or reverb send was applied to either low-frequency anchor.

The send map uses:

- Short reverb for percussion cohesion.
- Medium reverb for music, mechanical textures, and selected impacts.
- Long reverb for atmosphere, structural transitions, and restrained musical depth.
- Rhythmic delay for percussion detail, music, textures, and selected transitions.

### Percussion groove

Main percussion and detail/hi-hat stems now use deterministic 16-step velocity contours with bounded variation. Offbeat hi-hat accents are emphasized while avoiding identical repeated hits.

### Filtering

Every production channel has role-specific high-pass and low-pass filtering. Automated cutoff reductions were applied around bars:

- 32
- 64
- 80
- 112
- 128
- 168
- 184
- 208

The strongest cutoff motion is applied to music, atmosphere, and texture channels. Kick and bass receive static cleanup only.

## Stem package

The v0.4 package contains twelve aligned stems:

- kick
- bass
- drums main
- drums detail
- music
- atmosphere
- texture effects
- impacts and transitions
- delay return
- short reverb return
- medium reverb return
- long reverb return

All files are stereo 48 kHz / 24-bit WAV and share the same timeline.

## Team perspectives

### DARKSCO Artist

The new mix creates depth in layers rather than treating every channel equally. The central review question is whether the hi-hat now feels pleasant and human, and whether the long spatial effects increase tension without blurring the direct rhythm section.

### Venom

Review the groove at low volume and at club-oriented playback. The hi-hat should pull the body forward without becoming sharp or repetitive. The kick and bass must remain physically stable while the upper layers move around them.

### DARKSCO Mastering

The package now has appropriate pre-master headroom and independent returns. Do not master until the mix balance, groove, cutoff automation, and spatial map are approved.

### Ultron

The revised stems are aligned, checksum-indexed, and rendered without Ableton. The effects architecture is reproducible and can be integrated into the programmatic renderer.

### Hela

Cutoff and spatial transitions now provide stronger audiovisual control points.

### Bane

Compare v0.3 and v0.4 using section scores for groove, depth, clarity, low-end stability, transition impact, and fatigue.

### Thanos

Rights remain clear: original programmatic synthesis only, with no third-party samples or extracted stems.

### Doom

Recommendation: review v0.4 as the new production baseline before authorizing mastering.

## Irina gate

Irina must approve or revise the premaster before the DARKSCO Mastering Agent begins final processing.
