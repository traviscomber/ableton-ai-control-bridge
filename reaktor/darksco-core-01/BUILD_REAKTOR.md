# Build sequence — DARKSCO CIRCUIT 0.1

Build in Reaktor 6 full version.

## Stage 1 — audible core

1. Create new Instrument named `DARKSCO CIRCUIT 0.1`.
2. Add MIDI pitch/gate input.
3. Add OSC A: stable anti-aliased oscillator.
4. Add OSC B: stable anti-aliased oscillator.
5. Add cross-mod/FM amount between A and B with a bounded range.
6. Add wavefolder/nonlinear stage after oscillator mix.
7. Add multimode filter.
8. Add amp envelope and VCA.
9. Add output limiter/safety stage.
10. Confirm one note can be played cleanly before adding modulation.

Gate A: one note produces stable audio with no clipping.

## Stage 2 — groove and movement

1. Add tempo-synced LFO.
2. Add smooth random source.
3. Add probability pulse/hold source.
4. Route bounded modulation to oscillator interaction, filter, wavefold and stereo position.
5. Add stereo delay after VCA.

Gate B: repeated MIDI produces a groove-preserving voice; random modulation changes character without destroying timing.

## Stage 3 — eight macro layer

Create eight exposed host automatable controls, exactly named:

`ENERGY DENSITY MOTION CHAOS TONE TEXTURE DECAY SPACE`

Map them according to `mapping.json`.

Important:
- use internal scaling macros so each host control remains 0..1
- clamp feedback separately from CHAOS
- avoid direct host mapping to dangerous internal gain nodes
- make macro changes smooth enough for live automation

Gate C: all eight controls are visible to Ableton and remain continuous.

## Stage 4 — snapshots

Create 12 snapshots from README.md.

Keep macro values meaningful and consistent across snapshots. Snapshot changes may alter hidden topology values but must not redefine the semantic meaning of the eight macros.

Gate D: snapshot changes do not produce dangerous gain jumps or broken clock behavior.

## Stage 5 — DARKSCO performance variants

DAY: rhythmic clarity and reduced persistence.
NIGHT: dark low-end, movement, distortion and controlled depth.
WORLD: asymmetric rhythm and organic modulation while preserving dark-tech identity.

Gate E: each mode can be reached by the macro values in `mapping.json` without requiring manual hidden-parameter repair.

## Stage 6 — Ableton/TITAN

1. Load Reaktor VST on a dedicated MIDI track.
2. Load `DARKSCO CIRCUIT 0.1`.
3. Confirm exposed parameter names as reported by Live 11.
4. Map/automate only confirmed names.
5. Read values back after each initial TITAN write.
6. Add downstream EQ/Glue/Utility only after the instrument itself passes audible validation.

Final chain:

`MIDI → Reaktor CIRCUIT → EQ Eight → Glue/Compressor → Utility`

## Acceptance criteria

- Static: architecture and mapping complete.
- Runtime: .ens saved from Reaktor and reopens without missing dependencies.
- Bridge ACK: TITAN can change/read all eight macros.
- Audible: at least one DAY, one NIGHT and one WORLD snapshot approved in an actual Live mix.
- Performance: no uncontrolled feedback; no abrupt muting; CPU remains suitable for multiple DARKSCO instruments in the same Set.
