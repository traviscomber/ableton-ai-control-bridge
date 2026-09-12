# BLACK VECTOR — MIDI realization map

Canonical musical source: `BLACK_VECTOR_INTENT.yaml`.

## Pitch map

Ableton/MIDI pitch numbers used by the controller:

- F1 = 29
- C2 = 36
- Eb2 = 39
- F2 = 41
- C4 = 60
- Eb4 = 63
- E4 = 64
- F4 = 65
- Gb4 = 66
- Ab4 = 68
- C5 = 72

## Bass core — 2 bars

Use 1 beat = 1.0. Keep notes short enough to clear the following kick transient.

| Event | Pitch | Start | Duration | Velocity | Function |
|---|---:|---:|---:|---:|---|
| B1 | F1 / 29 | 0.50 | 0.38 | 105 | first gravity answer |
| B2 | C2 / 36 | 1.75 | 0.28 | 88 | upper counterweight |
| B3 | F1 / 29 | 3.25 | 0.34 | 98 | late return |
| B4 | F1 / 29 | 5.50 | 0.30 | 101 | second-bar answer |
| B5 | C2 / 36 | 6.75 | 0.24 | 84 | weak-beat tension |

Do not quantize microtiming globally. When runtime supports sub-beat offsets safely, selected answer attacks may trail by approximately 6–9 ms. Keep kick on-grid.

### Bass variation A

Omit B2. Extend B3 to 0.46 beats. Purpose: increase F gravity without increasing density.

### Bass variation B

Move B4 from 5.50 to 5.75 and omit B5. Purpose: make the phrase answer later and create room for the upper motif.

### Bass variation C — pre-peak

Use only B1 + B3, then remove bass entirely in bars 71–72.

## Primary motif — 2 bars

The motif must initially remain unresolved.

| Event | Pitch | Start | Duration | Velocity | Function |
|---|---:|---:|---:|---:|---|
| M1 | C5 / 72 | 0.75 | 0.24 | 108 | strongest identity attack |
| M2 | Gb4 / 66 | 1.50 | 0.36 | 92 | Phrygian pressure |
| M3 | Ab4 / 68 | 3.25 | 0.22 | 86 | upward answer |
| M4 | F4 / 65 | 6.75 | 0.50 | 100 | withheld until climax |

### Reveal policy

- Bars 1–8: rhythm/timbre shadow only; no complete pitched motif.
- Bars 9–16: use M1 + M2 only.
- Bars 17–24: M1 + M2; M3 appears only at phrase tail.
- Bars 25–32: M1 + M2 + M3. Bar 32 deliberately omits M3.
- Bars 33–40: transfer M1 one octave down on alternate phrases; preserve M2/M3 relationship.
- Bars 41–48: allow E4 / 64 immediately before F4 only once as a structural approach, not as a repeating chromatic decoration.
- Bars 49–56: stretch M2 and M3; expose space around them.
- Bars 57–64: shorten durations and narrow swing perception as reconstruction begins.
- Bars 65–72: nearly complete motif but continue withholding stable F4 ending; bars 71–72 remove bass.
- Bars 73–88: finally use M1 + M2 + M3 + M4. This is the first stable tonic completion.
- Bars 89–96: remove lead motif; retain only a filtered/rhythmic shadow if available.
- Bars 97–112: transpose motif register down one octave; omit Gb in the first transformed passes.
- Bars 113–120: use fragments only; no full four-event statement.

## Tonal answer cell

Use sparingly as a secondary cell, never as a second lead melody:

`Eb4 (63) -> E4 (64) -> F4 (65)`

Rhythm: short Eb on a weak subdivision, shorter E approach, longer F consequence. Reserve for late destabilization/reconstruction and never repeat identically more than once.

## Drum architecture for Rolandito

Do not bind pitches until the actual Drum Rack/machine mapping is inspected in Live.

### Kick
- Stable 4/4 authority in groove sections.
- Remove in bars 49–52.
- Full return in bar 57.
- Preserve authority through peak.

### Closed hat
- Early: broken 16th hierarchy, not every step.
- Development: increase subdivision while narrowing timing ambiguity.
- Peak 73–88: straight, obvious engine. Straight eighths or selective 16ths are preferred over swing.

### Open hat
- Punctuation only before peak.
- May become a clear quarter/offbeat pulse inside the climax if it supports, rather than masks, the closed-hat engine.

### Snare/clap
- Conversational role; do not lock one position for the full arrangement.
- Omit one expected response immediately before the rupture.

### Extra percussion
- Maximum one principal extra voice at a time before the climax.
- Avoid low-mid material that competes with F1/C2 bass.

## Section execution map

| Bars | Bass | Motif | Hats | Key consequence |
|---|---|---|---|---|
| 1–8 | off | shadow | sparse | establish physical space |
| 9–16 | off | C5/Gb4 | broken | identify pressure |
| 17–24 | core | partial | broken | establish pocket |
| 25–32 | A/B | +Ab4 | developed | first musical answer |
| 33–40 | B | octave mutation | developed | destabilize identity |
| 41–48 | intermittent | E→F once | straighter | point toward rupture |
| 49–56 | off first half | stretched | sparse/absent | expose motif |
| 57–64 | gradual return | shortened | straightening | rebuild inevitability |
| 65–72 | C then off 71–72 | near-complete | nearly straight | withhold peak |
| 73–88 | strongest controlled state | complete incl. F4 | straight | tonal + rhythmic payoff |
| 89–96 | reduced | off/shadow | reduced | subtraction |
| 97–112 | syncopated | octave-down transform | groove returns | altered identity |
| 113–120 | progressively removed | fragments | progressively removed | exit |

## Controller constraints

1. Do not generate device parameter automation until `inspect_device_parameters` has returned exact names/ranges from the active Live 11 session.
2. Do not assign drum MIDI pitches until the target machine/rack is inspected.
3. Serialize track/clip creation and wait for bridge ACK before dependent commands.
4. Preserve this map as musical truth; runtime adaptations may change implementation but not the musical function without a new Music Brain decision.
5. Runtime status remains `MUSICAL_STATIC` until Live confirms object creation; audible quality remains unverified until playback is actually heard.
