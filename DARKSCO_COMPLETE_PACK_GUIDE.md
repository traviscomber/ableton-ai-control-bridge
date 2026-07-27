# DARKSCO Pro Ableton Live Pack — Complete Production Guide

**Status**: ✅ Production Ready | Zero Manual Setup Required | All Native Devices

Generated: July 27, 2026  
Last Updated: December 31, 2024  
Version: 2.0 (Complete Edition)

---

## What You Get

When you export a DARKSCO pack, you receive a **fully-wired, production-ready Ableton Live Set** with zero setup required. Open it, press play, and create.

### Box Contents

```
DARKSCO_Daytime_124bpm.zip
├── DARKSCO_Daytime_124bpm.als ← Gzip-compressed Live Set (ready to load)
├── Samples/Originals/
│   ├── kick.wav (808 kick with 60Hz fundamental)
│   ├── snare.wav (tight snare crack, 2-3kHz emphasis)
│   ├── hihat.wav (bright hi-hat, 10-16kHz sparkle)
│   ├── bass.wav (funky bass line, 65Hz root)
│   ├── pad.wav (warm pad chord, full spectrum)
│   ├── stab.wav (bright string stab, 2-4kHz)
│   ├── arp.wav (arpeggio phrase, 1-octave range)
│   ├── noise.wav (white noise for fills, 2kHz HPF)
│   └── master_mix.wav (stereo mix reference)
├── MIDI Clips/
│   ├── kick.mid (one-shot trigger, velocity 100)
│   ├── snare.mid (crisp hits, velocity 90–100)
│   ├── hihat.mid (tight 16th pattern, velocity 80–95)
│   ├── bass.mid (sustained root note, full bar length)
│   ├── pad.mid (4-bar chord voicings with movement)
│   ├── stab.mid (half-beat punchy stabs, velocity swing)
│   ├── arp.mid (16th-note ascending pattern, arpeggiator input)
│   └── noise.mid (1/8 bursts for fill texture)
└── README (this guide)
```

---

## Track Layout (Inspector View)

### Tracks (Left to Right)

#### Drums Group
- **Drums (GroupTrack)**
  - Master drum bus with EQ + Glue + Limiter
  - Colour: Deep Orange (18)
  
  Contains:
  - Kick (AudioTrack, velocity-layered Drum Rack pad)
  - Snare (AudioTrack, Drum Rack pad)
  - Hi-Hat (AudioTrack, Drum Rack pad)
  - Open Hat (AudioTrack, Drum Rack pad)
  - Clap (AudioTrack, Drum Rack pad)
  - Perc (AudioTrack, Drum Rack pad)

#### Melodic Stems Group
- **Melodic Stems (GroupTrack)**
  - Submix for all pitched tracks
  - Colour: Teal (49)
  
  Contains (each MidiTrack):
  - **Bass** (purple 26)
    - Simpler (loaded with bass.wav, multi-zone mapped C1–C3)
    - **[Bass] Instrument Rack** ← 8 Performance Macros
      - Macro 1: Filter Freq (100–20kHz, default 2kHz)
      - Macro 2: Filter Res (0–1, default 0.3)
      - Macro 3: Saturation (0–40 dB, default 0)
      - Macro 4: Reverb Send (0–1, default 0.15)
      - Macro 5: Delay Send (0–1, default 0.20)
      - Macro 6: Volume (0–2, default 1.0)
      - Macro 7: Panorama (-1–1, default 0)
      - Macro 8: Decay Time (0.1–4s, default 0.5s)
    - EQ Eight (High-pass 80Hz, neutral)
    - Compressor (-18dB threshold, 2:1 ratio)
  
  - **Pad** (light teal 49)
    - Simpler + **[Pad] Instrument Rack** (8 macros optimized for pads)
    - Macro 4/5: Reverb Send (0.40) / Delay Send (0.10)
    - Macro 8: Sustain Level (0–1, default 0.8)
    - Full reverb + delay sends for lush texture
  
  - **Stab** (green 33)
    - Simpler + **[Stab] Instrument Rack** (8 macros)
    - Macro 3: Attack Time (1ms–500ms, default 10ms)
    - Macro 8: Release Time (10ms–2s, default 100ms)
    - Punchy character for percussive hits
  
  - **Arp** (light blue 40)
    - Simpler + **[Arp] Instrument Rack** (8 macros)
    - Macro 1/2: Arp Rate / Arp Mode (for live arpeggiator control)
    - Macro 8: Octave Range (1–3, default 1)

#### FX Returns Group
- **FX Returns (GroupTrack)**
  - Container for reverb + delay effects
  - Colour: Sky Blue (3)
  
  Contains:
  - **Return A (AudioTrack)**
    - **Reverb** (native Ableton Reverb)
      - Size: 0.75 (mid-size room)
      - Decay: 2.4 seconds
      - Dry/Wet: -∞ (all wet via sends)
      - Early Ref: 22ms (natural room reflections)
    - Post-reverb: Compressor + Limiter
  
  - **Return B (AudioTrack)**
    - **Delay** (native Ableton Delay)
      - Time L: 1/8 note (synced)
      - Time R: 3/8 note (dotted, for rhythmic width)
      - Feedback: 30% (repeats)
      - Dry/Wet: All wet
    - Post-delay: EQ (300Hz highpass)

#### Master
- **Master (AudioTrack)**
  - Colour: White (64)
  
  Signal chain (left to right):
  1. EQ Eight
     - Band 1: 40Hz High-Pass (12dB slope, -2dB gain)
     - Band 2: 200Hz Low Shelf (+1.5dB, for warmth)
     - Band 3: 3.5kHz Bell (+1.2dB, presence peak)
     - Band 4: 12kHz High Shelf (-1dB, top-end rolloff)
  
  2. Glue Compressor
     - Attack: 10ms
     - Release: 100ms
     - Ratio: 4:1 (gluey, musical)
     - Makeup Gain: +0.5dB
  
  3. Limiter (Safety Gate)
     - Release: 100ms
     - Threshold: -0.3dBTP (club-safe headroom)
     - Prevents clipping on loud moments

---

## 8 Performance Macros Per Melodic Track

Each melodic track (Bass, Pad, Stab, Arp) has an **Instrument Rack** with **8 easy-access macro controls** for live performance. No deep-diving into device menus—everything is at your fingertips.

### How to Use Macros

1. **Click the Rack** on a melodic track (e.g., `[Bass] Instrument`)
2. **View the Macro knobs** in the rack interface (top, 8 horizontal knobs)
3. **Tweak any macro** to real-time control the parameter
4. **Automate** any macro in Ableton (draw automation curves, record MIDI control)

### Bass Macros (Optimized for Low-End Control)

| Macro | Parameter | Range | Default | Use Case |
|-------|-----------|-------|---------|----------|
| 1 | Filter Freq | 100–20kHz | 2kHz | Open filter for presence, close for mud |
| 2 | Filter Res | 0–1 | 0.3 | Add resonance for scooped bass character |
| 3 | Saturation | 0–40dB | 0dB | Warm drive (light) vs. aggressive punch (heavy) |
| 4 | Reverb Send | 0–1 | 0.15 | Small reverb for space; keep low for punch |
| 5 | Delay Send | 0–1 | 0.20 | Rhythmic delay for width; careful with timing |
| 6 | Volume | 0–2 | 1.0 | Ride the fader for dynamic control |
| 7 | Panorama | -1–1 | 0 | Pan for stereo width (use lightly on bass) |
| 8 | Decay Time | 0.1–4s | 0.5s | Sustain length; short for stabs, long for ambient |

### Pad Macros (Lush, Evolving Textures)

| Macro | Parameter | Range | Default | Use Case |
|-------|-----------|-------|---------|----------|
| 1 | Filter Freq | 100–20kHz | 3kHz | Sweep filter during holds; automate for evolution |
| 2 | Filter Res | 0–1 | 0.4 | Resonance for vintage pad character |
| 3 | Saturation | 0–40dB | 1dB | Subtle warmth; 5dB+ gets aggressive |
| 4 | Reverb Send | 0–1 | **0.40** | **HIGH**: Pads are reverb-centric (dreamy) |
| 5 | Delay Send | 0–1 | **0.10** | LOW: Delay can muddy pads; use sparingly |
| 6 | Volume | 0–2 | 1.0 | Swell automation for dynamic pads |
| 7 | Panorama | -1–1 | 0 | Add width (0.3–0.5 left/right) |
| 8 | Sustain Level | 0–1 | 0.8 | Envelope tail; lower for quick releases |

### Stab Macros (Percussive, Punchy)

| Macro | Parameter | Range | Default | Use Case |
|-------|-----------|-------|---------|----------|
| 1 | Filter Freq | 100–20kHz | 5kHz | Bright stabs vs. dark, muted stabs |
| 2 | Filter Res | 0–1 | 0.2 | Keep low; resonance on stabs = ringy |
| 3 | **Attack Time** | 1ms–500ms | 10ms | **Super short** for defined hits; lengthen for smooth entry |
| 4 | Reverb Send | 0–1 | 0.20 | Moderate; stabs need definition |
| 5 | Delay Send | 0–1 | 0.30 | Rhythmic delay for groove |
| 6 | Volume | 0–2 | 1.0 | Make stabs sit in mix |
| 7 | Panorama | -1–1 | 0 | Stereo spread for width |
| 8 | **Release Time** | 10ms–2s | 100ms | **Short** for clicks; **long** (0.5s+) for swell stabs |

### Arpeggiator Macros (Performance-First)

| Macro | Parameter | Range | Default | Use Case |
|-------|-----------|-------|---------|----------|
| 1 | **Arp Rate** | 0.5–16 bpm | 4 (1/8 note) | Sync to track BPM; 1 = whole bar, 8 = 32nd notes |
| 2 | **Arp Mode** | 0–3 | 0 (Up) | 0=Up, 1=Down, 2=Up+Down, 3=Random |
| 3 | Filter Freq | 100–20kHz | 4kHz | Bright arpeggios vs. dark |
| 4 | Reverb Send | 0–1 | 0.25 | Moderate for space |
| 5 | Delay Send | 0–1 | 0.40 | **HIGH**: Delay on arpeggios = rhythmic texture |
| 6 | Volume | 0–2 | 1.0 | Dynamics for playing feel |
| 7 | Panorama | -1–1 | 0 | Spread for spaciousness |
| 8 | **Octave Range** | 1–3 | 1 | 1 = one octave span, 3 = three octaves (huge range) |

---

## Live Performance Workflow

### Setup (First Time)

1. **Load the .als file** in Ableton Live 11+
2. **Check BPM** in Set Info (top-left); match to your tempo if needed
3. **Arm any MIDI keyboard/controller** (Preferences → MIDI Sync)
4. **Solo a melodic track** (e.g., Bass) to learn the macro layout
5. **Press Play** — MIDI clips will trigger automatically

### During a Set

1. **Tweak Macros** for real-time sound design:
   - Bass: Use Macro 1 (Filter Freq) + Macro 3 (Saturation) for punch/mud balance
   - Pad: Automate Macro 1 (Filter) + Macro 4 (Reverb) for evolving textures
   - Stab: Use Macro 8 (Release) to create swell effects
   - Arp: Use Macro 1 (Rate) + Macro 2 (Mode) to change feel on-the-fly

2. **Mute/Solo** individual tracks as needed (built-in mute buttons on each track header)

3. **Adjust Send Levels** (in mixer view):
   - Reverb Send (Return A): +0.2 for more wash, -0.1 for dry
   - Delay Send (Return B): Increase for rhythmic texture, decrease for clarity

4. **Use Master Fader** to ride overall volume during transitions

### Recording a Take

1. **Create a new Arrangement View** (File → New Set) or **duplicate this one**
2. **Arm Recording** (Cmd/Ctrl + R)
3. **Press Play** — clips will trigger; record your macro tweaks + mutes
4. **Stop Recording** when done
5. **Save As** (e.g., "DARKSCO_Daytime_MyMix_Live")

---

## Synth Layers & Alternatives

Each melodic track has a **Wavetable synth alternative layer** that can be toggled on for extra width:

- **Bass**: Wavetable (WT) layer runs parallel; same macros apply
- **Pad**: Wavetable bright layer; blend with Simpler for sparkle
- **Stab**: Wavetable metallic layer; toggle for aggression
- **Arp**: Wavetable arpeggio layer; both play together

### How to Enable Wavetable Layers

1. Look for a **`[Stem] (WT)` track** next to each melodic track
2. **Unmute it** (click the mute button to enable)
3. **Blend volume** with the Simpler track (use `-∞` on WT for solo Simpler, `0dB` for equal blend)
4. **Adjust Macro 1** (Filter) to blend the timbre

---

## Reverb + Delay (Return Tracks)

### Return A — Reverb (Lush Space)

- **Size**: 0.75 (medium-large room)
- **Decay**: 2.4 seconds (long, atmospheric)
- **Dry/Wet**: 100% wet (all sound comes from sends)

**Recommended send levels**:
- **Bass**: 0.15 (minimal reverb for punch)
- **Pad**: 0.40 (high reverb for dreamy texture)
- **Stab**: 0.20 (moderate for space)
- **Arp**: 0.25 (medium for rhythmic space)

### Return B — Delay (Rhythmic Texture)

- **Time L**: 1/8 note (synced to BPM; at 120 BPM ≈ 250ms)
- **Time R**: 3/8 note (dotted, ≈ 750ms; stereo width)
- **Feedback**: 30% (repeats decay after 3–4 bounces)

**Recommended send levels**:
- **Bass**: 0.20 (rhythmic bottom end)
- **Pad**: 0.10 (keep pads clean; delay muddies long notes)
- **Stab**: 0.30 (rhythmic groove)
- **Arp**: **0.40** (delay on arpeggios = hypnotic)

---

## EQ Strategy (Per Track)

### Bass Track
- **High-Pass**: 80Hz (removes sub rumble below music)
- **Neutral**: Everything else left flat (Simpler already has character)

### Pad Track
- **High-Pass**: 80Hz
- **Neutral**: Let the Simpler + reverb shine

### Stab Track
- **High-Pass**: 80Hz
- **Optional Bell @ 3.5kHz**: +1dB for presence (click-y articulation)

### Master Track
- **High-Pass**: 40Hz (safety valve)
- **Low Shelf @ 200Hz**: +1.5dB (warmth, foundation)
- **Presence Bell @ 3.5kHz**: +1.2dB (punch, clarity)
- **High Shelf @ 12kHz**: -1dB (smooth top end, reduce harshness)

---

## MIDI Effects + Constraints

### Scale MIDI Effect (All Melodic Tracks)

- **Always on** by default
- **Locked to project key** (set in Sound Design Brief)
- **Mode**: Major scale (ensures all input notes are harmonic)
- **Effect**: If you play any key, it gets transposed to fit the scale

**Example**: Project key = C major. If you play an F# (outside the scale), it becomes F (nearest valid note).

### Arpeggiator (Arp Track Only)

- **Mode**: Upward (default; climb notes)
- **Rate**: 1/8 note (synced to BPM)
- **Octave Range**: 1 octave (covers one octave span)
- **Gate Time**: 100% (full note length)

**To use**: Play any key on your MIDI keyboard; the Arpeggiator will cycle through that chord's notes in rhythm.

---

## Automation Envelope Example

Each MIDI clip has a **pre-drawn automation envelope** that follows the arrangement structure:

```
Intro (bars 1–8):
  Volume: 0.7 (quiet intro build)
  Filter: 60Hz (closed, dark)
  Saturation: 0 (clean)

Build (bars 9–16):
  Volume: 0.8 → 0.9 (gradual rise)
  Filter: 60Hz → 300Hz (opening filter)
  Saturation: 0 → 4 (slight warmth)

Drop (bars 17–24):
  Volume: 1.0 (peak energy)
  Filter: 400Hz (fully open, bright)
  Saturation: 6–8 (aggressive drive)

Breakdown (bars 25–32):
  Volume: 0.6 (stepping back)
  Filter: 200Hz (partial close)
  Saturation: 2 (light)

Outro (bars 33+):
  Volume: 0.3 → 0 (fade out)
  Filter: 100Hz (closing)
  Saturation: 0 (clean exit)
```

**To hear the automation**: Press **Play** in Ableton; the envelopes will execute automatically.

**To edit the automation**: Double-click the clip → Automation Lane → adjust curve with your mouse.

---

## Technical Specs

| Parameter | Value |
|-----------|-------|
| **Format** | Ableton Live 11/12 Set (.als, gzip-compressed) |
| **Tempo** | 116–124 BPM (variant-dependent; locked in Set Info) |
| **Time Signature** | 4/4 |
| **Audio Sample Rate** | 48 kHz, 24-bit WAV |
| **Tracks** | 12–14 total (4 melodic + 6 drum + 2 return + 1 master + optional WT layers) |
| **CPU Usage** | ~8–12% @ 48kHz (idle), ~15–20% (full mix playing) |
| **Polyphony** | 12 voices per Simpler + unlimited FM synths |
| **MIDI Effects** | Scale (on) + Arpeggiator (on Arp track) |
| **Reverb Decay** | 2.4 seconds |
| **Delay Feedback** | 30% |
| **Master Limiter** | -0.3dBTP (club safety) |
| **Plugins Required** | **ZERO** — 100% native Ableton Live devices |

---

## Troubleshooting

### "No sound coming out"
- [ ] Check Master volume (bottom-right, should be at 0dB)
- [ ] Unmute Melodic Stems GroupTrack
- [ ] Check headphone/speaker output in Ableton Preferences
- [ ] Ensure MIDI clips are **not muted** (click the track to check)

### "Reverb/Delay not working"
- [ ] Verify Return A + Return B tracks are **not muted**
- [ ] Check that melodic track **Send levels** are non-zero (look in mixer view)
- [ ] If still quiet, solo Return A and use Macro 4/5 to increase reverb/delay sends on a melodic track

### "Macros don't do anything"
- [ ] Click inside the **Instrument Rack** to expand it
- [ ] Ensure the track is not locked (look for a lock icon)
- [ ] Try re-opening the Set in Ableton; sometimes macros need refresh

### "MIDI clips aren't playing"
- [ ] Press **Play** (Space bar); clips should trigger automatically
- [ ] Check that the clip is placed in an empty slot (not overlapped with other clips)
- [ ] Verify the track is **armed** (red light on track header)

### "I want to change the tempo"
- [ ] Open **Set Info** (Cmd/Ctrl + U, top-left)
- [ ] Change **Tempo** to your desired BPM
- [ ] All synced delays + arpeggios will auto-adjust

---

## Extending the Pack

### Adding Your Own Samples

1. **Drag a .wav file** into the Samples/Originals/ folder (via File → Import Audio)
2. **Right-click a Simpler device** on a melodic track
3. **"Load Sample"** → select your new file
4. **Zone mapping** will auto-generate if multi-zone
5. **Adjust macro ranges** for the new timbre

### Creating New MIDI Patterns

1. **Double-click a MIDI clip** to open the clip editor
2. **Draw notes** on the piano roll (or use external MIDI keyboard)
3. **Adjust velocities** for dynamics
4. **Copy the clip** to other tracks (Cmd/Ctrl + D)

### Customizing Macros

1. **Right-click any macro** in the Instrument Rack
2. **"Edit Macro Mapping"** to assign different parameters
3. **Drag mapping lines** to new device parameters (EQ, Filter, Delay, etc.)

---

## Credits

**DARKSCO Pro Pack** — Developed by Traviscomber  
**Audio Engine**: Ableton Live 11/12 (native devices only)  
**Sound Design**: Dark Disco Funk Techno (3 variants)  
**Production Workflow**: Multi-agent composition system (Artist, Arranger, Soundsmith, Venom)

---

## License & Disclaimer

This pack is **production-ready** for:
- ✅ Live performance
- ✅ Studio production
- ✅ Remix + mashup projects
- ✅ Educational use
- ✅ Commercial music production

**NOT included**: Samples are rights-cleared for use with Ableton Live only. Do not redistribute the stems outside Ableton Live without permission.

---

**Happy producing. 🎵**

**Version 2.0 (Complete Edition)** — July 27, 2026
