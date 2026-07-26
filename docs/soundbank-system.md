# DARKSCO Soundbank System

Status: **ACTIVE — Core Night 001 started**  
Decision owner: **Irina**  
Creative owner: **DARKSCO Artist**  
Musical review: **Venom**  
Technical owner: **Ultron**  
Rights owner: **Thanos**

## Objective

Build a proprietary DARKSCO sound library from original synthesis, transformed recordings, documented AI-assisted generation, and rights-cleared source material. The library must support complete programmatic track production without Ableton while remaining compatible with later DAW use.

## Library architecture

```text
soundbank/
  core-night-001/
    kick/
    bass/
    percussion/
    impact/
    atmosphere/
    texture/
    transition/
    manifest.json
    curation.json
```

Each accepted asset must include:

- stable asset ID,
- category and DARKSCO state,
- generator or source method,
- deterministic seed when applicable,
- sample rate and bit depth,
- duration and peak level,
- SHA-256 checksum,
- rights status,
- source-policy record,
- Artist notes,
- Venom review score,
- Irina approval state.

## Source hierarchy

Preferred order:

1. Original synthesis.
2. Original field recordings.
3. Resampling of DARKSCO-owned sounds.
4. Rights-cleared licensed one-shots.
5. AI-generated source material with explicit commercial rights and recorded terms.
6. Never unidentified extracted commercial stems.

## Core Night 001 scope

The first generator creates:

- short controlled kicks,
- mono sub hits,
- metallic percussion,
- cinematic low impacts,
- evolving atmospheres.

Next generators should add:

- hats and noise percussion,
- industrial clanks and scrapes,
- tonal motifs and drones,
- risers, downlifters, and void transitions,
- convolution impulses,
- distortion and resampling variants,
- stereo textures with mono-compatible low end.

## Curation gate

Generated does not mean accepted. Every asset is graded from 1–5 on:

- identity,
- usefulness,
- transient quality,
- spectral balance,
- noise and artifact control,
- transformation potential,
- compatibility with DARKSCO Night,
- similarity risk,
- rights confidence.

Acceptance rules:

- Reject any asset with clipping, DC offset, truncated tails, unexplained silence, or unclear rights.
- Reject generic assets that duplicate stronger material.
- Reject sounds that only work when excessively loud.
- Reject assets with audible generation defects unless the defect is intentional and musically useful.
- Keep no more than the strongest 20–30% of generated candidates.
- Require Irina approval before an asset enters the official Core library.

## AI-assisted improvement loop

1. Generate deterministic candidates across bounded parameter ranges.
2. Compute technical descriptors and reject obvious defects.
3. Render audition sequences in musical context.
4. Artist evaluates character and transformation potential.
5. Venom evaluates catalogue fit and musical usefulness.
6. Bane records scores and identifies successful parameter regions.
7. Generate a focused second round around the strongest regions.
8. Thanos confirms provenance and rights.
9. Irina approves or rejects the curated release set.

## Programmatic track integration

The Artist renderer should reference assets by stable ID, never by arbitrary filename. A track manifest records every library asset used and its checksum. This allows a production to be recreated exactly and prevents unnoticed sound replacement.

Example:

```json
{
  "track": "night-protocol-001",
  "asset_refs": [
    "darksco_night_night_kick_003",
    "darksco_night_sub_hit_002",
    "darksco_night_atmosphere_004"
  ]
}
```

## Team perspectives

### DARKSCO Artist

The bank should feel like an instrument, not a sample dump. Each sound must invite transformation and remain useful across arrangements. The first release should be compact and recognizable rather than large.

### Venom

The strongest assets must create catalogue continuity without making every track identical. Keep families of related sounds with controlled variants rather than unrelated presets.

### Ultron

Deterministic generation, stable IDs, checksums, and strict WAV specifications are mandatory. The initial renderer uses dependency-free Python so it can run in controlled environments.

### DARKSCO Mastering

Do not pre-master library assets. Preserve transient and dynamic flexibility. Avoid loudness normalization and irreversible limiting.

### Thanos

Every imported or AI-generated source requires a retained license record. Original synthesis remains the safest default.

### Bane

Track acceptance rates, review scores, usage frequency, and which sounds survive into released masters. Remove unused or weak material from the active Core set.

### Hela

Asset families can later receive visual identifiers and waveform thumbnails, but audio identity takes priority.

### Doom

Build a small proprietary Core first, prove it in Night Protocol 001, then expand into Noon and Morning libraries.

### Irina

Final approval applies to both the soundbank release and the track produced with it. Quantity never compensates for weak identity.
