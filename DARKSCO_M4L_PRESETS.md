# DARKSCO Pro Pack — Max for Live Integration & Presets

## Overview

The DARKSCO Pro Pack includes native Ableton synths (Wavetable, Operator, Sampler) with professional presets. Max for Live (M4L) devices are optional enhancements for advanced users.

---

## Native Synth Presets (Built-in)

### Multi-Layer Wavetable Synths

All melodic tracks include Wavetable alt-layers with multiple presets available:

#### Layer 1: Init Osc (Soft Foundation)
- **Wavetable**: Init Osc
- **Filter Freq**: 0.6 (8000 Hz)
- **Resonance**: 0.3 (subtle)
- **Unison**: 1 voice
- Best for: Pad foundations, warm pads

#### Layer 2: Square Bright (High-End Presence)
- **Wavetable**: Square
- **Transpose**: +1 octave (brightness)
- **Unison**: 2 voices (width)
- **Filter Freq**: 0.75 (10000 Hz)
- **Resonance**: 0.2 (clean)
- Best for: Bright stabs, sparkle layers, high textures

**Macro Controls** (8 per Wavetable track):
1. **Filter Freq** — 100 Hz to 20 kHz (morphing darkness to brightness)
2. **Filter Res** — 0 to 1 (resonance peak)
3. **Saturation** — 0 to 40 (analog warmth)
4. **Reverb Send** — 0 to 1 (spatial depth)
5. **Delay Send** — 0 to 1 (rhythmic motion)
6. **Volume** — 0 to 2 (mix balance)
7. **Panorama** — −1 to 1 (stereo width)
8. **Effect Wet/Dry** — 0 to 1 (effect blend)

---

### Operator FM Synthesis Presets

FM synth is available as an alternative layer for each melodic stem. Four presets included:

#### Bell (Classic FM)
- **Algorithm**: 3 (single modulator)
- **Carrier/Mod Ratio**: 1:2 (harmonic)
- **FM Index**: 8 (rich harmonics, bell timbre)
- **Use Cases**: Glassy textures, pad bells, evolving atmospheres
- **Macro Mapping**: Filter cutoff → Table Index (spectral morphing)

#### Pad (Smooth Evolution)
- **Algorithm**: 2 (dual modulators)
- **Carrier/Mod Ratio**: 1:1.5, 1:2 (consonant intervals)
- **FM Index**: 4 (subtle modulation)
- **Use Cases**: Warm pads, slow evolving textures
- **Automation**: Modulator volume → Dynamic depth

#### Bright (Lead Synth)
- **Algorithm**: 1 (cascaded modulators)
- **Carrier/Mod Ratio**: 1:2, 1:4, 1:8 (harmonic series)
- **FM Index**: 6 (punchy bright tone)
- **Use Cases**: Bright stabs, leads, percussive synth
- **Performance**: Arpeggiator input for fast arps

#### Metallic (Inharmonic Bells)
- **Algorithm**: 4 (complex feedback)
- **Carrier/Mod Ratio**: 1:0.5, 1:3, 1:5 (inharmonic)
- **FM Index**: 10 (aggressive modulation)
- **Use Cases**: Metallic bells, clang tones, sound design
- **Creative Control**: Filter + Saturation for transformation

**FM Macro Automation Ready**:
- All 4 operator volumes are automatable
- Ratio parameters mapped to macro sliders (preset switching via live control)
- Envelope parameters accessible per operator

---

### Sampler with Granular Warping

Enhanced Sampler on select tracks (bass, pad) with:
- **Grain Size**: 40 ms (granular texture)
- **Warp Mode**: Enabled (time-stretch without pitch change)
- **Transposition**: ±48 semitones available
- **Loop/One-Shot**: Configurable per clip

Presets included for creative warping:
- **Smooth Warp**: Grain 60 ms, Warp On (slow evolving texture)
- **Glitch Warp**: Grain 5 ms, Warp On (rhythmic stuttering)
- **Pitch Shift**: Grain 40 ms, +12 semitones (octave doubling)

---

## MIDI Effects Stack — Performance Control

All melodic tracks include an advanced MIDI chain for live performance:

### Standard Stack (Ready)
1. **Scale** — Locked to C major (constrains input to scale)
2. **Arpeggiator** — Up mode, 1/8 beat (rhythmic control)
3. **Optional: Chord** — Major triads (note doubling)
4. **Optional: Note Length** — Humanize mode (groove)

### Enable/Disable Effects
- Scale: Always active (harmonic safety)
- Arpeggiator: Configurable per track (Arp track default ON)
- Chord: OFF by default (enable for automatic voicing)
- Note Length: OFF by default (enable for humanized groove)

### Performance Workflow
1. **Hold chord on keyboard** → Scale constrains input
2. **Enable Arpeggiator** → Play rhythmic pattern
3. **Enable Chord** → Auto-voice held notes
4. **Enable Note Length** → Add organic swing

---

## Max for Live Devices (Optional Enhancements)

For users with M4L license, additional devices can be created:

### DARKSCO_Preset_Switcher.amxd
**Purpose**: Switch between synth presets on the fly without stopping playback

**Features**:
- 8 preset slots per track (Wavetable, Operator, Sampler)
- Crossfade time control (0–2 seconds)
- MIDI CC mapping for instant switching
- Visual preset name display

**Setup**:
1. Drop on empty MIDI track in project
2. Map device output to target synth track input
3. Assign MIDI CCs (CC 20–27 for presets)
4. Switch presets live during performance

### DARKSCO_FM_Morpher.amxd
**Purpose**: Morph between Operator presets (Bell ↔ Bright ↔ Metallic)

**Features**:
- X-Y pad morphing between 4 FM presets
- Real-time operator ratio blending
- LFO modulation for evolving FM
- Preset recall bank

### DARKSCO_Wavetable_Modulator.amxd
**Purpose**: Automatic wavetable morphing via LFO/envelope

**Features**:
- Multi-wavetable morphing (Init → Square → Sawtooth → Custom)
- LFO speed/depth controls
- Envelope follower (responds to input amplitude)
- Harmonic analysis for resonance modulation

### DARKSCO_Arpeggiator_Polyrhythm.amxd
**Purpose**: Advanced arpeggiator with polyrhythmic patterns

**Features**:
- Dual arpeggiators in parallel (1/8 + 1/12 = polyrhythm)
- 8 pattern modes (Up, Down, Up+Down, Random, Custom)
- Humanization (velocity + timing randomness)
- MIDI learn for live control

---

## Preset Configuration File

All presets are stored in `DARKSCO_Presets.json` (in the .zip pack):

```json
{
  "metadata": {
    "version": "1.0",
    "date": "2026-07-27",
    "author": "DARKSCO Production"
  },
  "synth_presets": {
    "wavetable_soft": {
      "name": "Soft Init Osc",
      "wavetable": "Wavetables/Init Osc",
      "filter_freq": 0.6,
      "resonance": 0.3
    },
    "wavetable_bright": {
      "name": "Bright Square",
      "wavetable": "Wavetables/Square",
      "filter_freq": 0.75,
      "resonance": 0.2,
      "transpose": 12
    },
    "operator_bell": {
      "name": "Bell FM",
      "algorithm": 3,
      "fm_index": 8,
      "modulator_ratio": 2
    },
    "operator_bright": {
      "name": "Bright Lead",
      "algorithm": 1,
      "fm_index": 6,
      "modulator_ratio": [2, 4, 8]
    }
  },
  "midi_fx_chains": {
    "standard": ["Scale", "Arpeggiator"],
    "advanced": ["Scale", "Chord", "Arpeggiator", "Note Length"]
  }
}
```

---

## Live Performance Tips

### Using Multi-Layer Synths
1. Wavetable Layer (Init Osc): Soft pad foundation
2. Wavetable Layer (Square): Turn up macro #6 (Volume) for bright top
3. Operator Layer (FM): Add macro sweep for evolving texture
4. Result: 3-layer synth with independent control

### Chaining Arpeggiators
1. Enable Arpeggiator on Bass track (1/8 up pattern)
2. Enable 2nd Arpeggiator on Pad track (1/16 down pattern)
3. Result: Polyrhythmic interplay between stems

### FM Bell Textures
1. Select Operator preset: Bell
2. Automate Macro #1 (Filter Freq) over 4 bars
3. Result: Evolving bell tone (attack bright, sustain warm, release dark)

### Wavetable Morphing
1. Hold all 4 notes on keyboard (chord)
2. Enable Scale + Chord MIDI effects
3. Sweep Macro #1 (Filter Freq) + Macro #2 (Resonance)
4. Result: Morphing pad chord with spectral evolution

---

## Technical Specifications

### CPU Usage (per track)
- Wavetable (single): ~3–5% CPU
- Wavetable (multilayer): ~6–9% CPU
- Operator (FM): ~4–7% CPU
- Sampler (warped): ~2–4% CPU
- Total MIDI FX chain: ~1–2% CPU

### Polyphony
- All synths: 12-voice polyphony (12 simultaneous notes)
- Drum Rack: 6 pads (simultaneous)

### Latency
- All devices: <1 ms (real-time ready)
- MIDI effects: <0.5 ms

### Compatibility
- Ableton Live 11+ (Native devices all 11+)
- Max for Live: 11+ (optional M4L devices)
- macOS 10.11+ / Windows 7+

---

## Troubleshooting

### Wavetable Layer Not Hearing
- Check Macro #6 (Volume) — might be at 0
- Check mute button on track
- Check audio routing (Return A/B sends)

### Operator FM Too Loud/Quiet
- Adjust operator volume in preset (default 0.8)
- Use Macro #6 to control output level
- Check mixer device volume

### Arpeggiator Not Working
- Enable it explicitly (default OFF except Arp track)
- Check MIDI input routing (should be "External: All")
- Adjust rate (default 1/8) and octaves (default 1)

### Preset Switching (M4L)
- Ensure MIDI CC is mapped to CC 20–27
- Check device is armed for MIDI learn
- Verify target synth track is enabled

---

## Updates & Support

For updates, presets, or custom configurations:
- DARKSCO Pro Pack v1.0 — July 2026
- Future presets planned: Techno, House, Ambient, Industrial

All devices are 100% native Ableton — no external plugins required.
