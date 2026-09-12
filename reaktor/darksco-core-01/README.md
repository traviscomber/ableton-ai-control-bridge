# DARKSCO REAKTOR CORE 01

Canonical first Reaktor ensemble blueprint for DARKSCO live performance.

## Purpose

Build one reusable ensemble core that can become CIRCUIT, BASS, CLOUD, PULSE, HARMONIC and WORLD variants without changing TITAN's control grammar.

Target: groovy dark tech that remains playable, musical and safe on stage.

## Signal architecture

MIDI / clock
→ NOTE ENGINE
→ OSC A + OSC B + NOISE/GRAIN source
→ cross-mod / FM matrix
→ wavefolder / nonlinear color
→ multimode filter
→ controlled feedback bus
→ VCA / dynamics
→ stereo motion
→ delay / space
→ safety limiter
→ OUT L/R

## Modulation architecture

Sources:
- envelope
- tempo LFO 1
- free LFO 2
- random smooth
- sample & hold
- probability pulse
- velocity
- aftertouch / macro input when available

Every modulation path must have a bounded amount. CHAOS must never be able to produce runaway feedback or unbounded gain.

## TITAN macro contract

Expose exactly these eight primary host-automatable macros:

1. ENERGY — drive, VCA intensity, oscillator interaction
2. DENSITY — voices/events/grains/secondary oscillator contribution
3. MOTION — LFO depth, stereo movement, evolving modulation
4. CHAOS — probability, random modulation, controlled feedback variance
5. TONE — spectral center, filter brightness, harmonic balance
6. TEXTURE — wavefold/noise/grain/degradation amount
7. DECAY — envelope/feedback persistence
8. SPACE — stereo depth, delay/reverb send and diffusion

TITAN must address musical intent through these macros rather than raw internal parameters.

## Performance modes

### DAY
- cleaner transients
- lower feedback
- brighter but controlled tone
- groove-forward
- shorter decay and space
- lower CPU modulation density

### NIGHT
- darker spectral center
- deeper sub and body
- more nonlinear color
- more controlled feedback
- wider motion
- longer decay and space
- highest priority DARKSCO club mode

### WORLD
- preserve DARKSCO low-end and groove
- introduce asymmetrical pulse, modal intervals and organic modulation
- use percussive/noise sources for hand-played character
- avoid genre caricature; rhythm and timbre should feel globally influenced, not sample-pack themed

## First instrument: CIRCUIT 0.1

CIRCUIT is the first voice built from CORE 01.

Minimum viable voice:
- 2 oscillators
- oscillator sync or phase/FM interaction
- wavefolder
- noise source
- 2-pole or 4-pole multimode filter
- one bounded feedback loop
- amp envelope
- tempo LFO
- smooth random modulator
- stereo delay
- limiter

Initial musical behavior:
- monophonic or 4-voice selectable
- stable bass/register tracking from C1 to C4
- no abrupt gain jumps when snapshots change
- macro moves must be performable while audio is running

## Snapshot bank

Create at least 12 snapshots:

DAY 01 Pulse
DAY 02 Dry Machine
DAY 03 Moving Chord
DAY 04 Light Circuit

NIGHT 01 Sub Ritual
NIGHT 02 Black Motor
NIGHT 03 Acid Shadow
NIGHT 04 Deep Machine

WORLD 01 Broken Hand
WORLD 02 Desert Voltage
WORLD 03 Forest Clock
WORLD 04 Ritual Grid

Each snapshot must remain within the same macro ranges so TITAN automation stays valid across snapshot changes.

## Live-performance rules

- no parameter may create +12 dB or larger discontinuities on normal macro moves
- feedback path must be limited before returning to the summing node
- snapshot changes should not reset clock-synced modulation unexpectedly
- keep one emergency SAFE macro/state with low feedback, low space and conservative output
- design for 48 kHz live use first
- prefer one high-quality voice architecture over excessive polyphony
- CPU target: conservative enough to run multiple DARKSCO ensembles in one Live set

## Ableton placement

Use Reaktor as an instrument on its own MIDI track.

Recommended chain:

MIDI → Reaktor / DARKSCO CIRCUIT → EQ Eight → Compressor or Glue → Utility

Do not place DARKSCO FIELD after Reaktor or Operator as a serial instrument. FIELD remains a separate instrument track.

## Validation gates

Static: macro contract, ranges and snapshot design documented.
Runtime: actual .ens loaded in Reaktor 6 and visible in Ableton Live 11.
Bridge ACK: TITAN can set and read back exposed macros.
Audible: DAY/NIGHT/WORLD are listened to in context and approved for groove, tonal balance and transitions.

The binary .ens must be created and saved from Reaktor itself; this repository stores the canonical architecture and mapping contract.