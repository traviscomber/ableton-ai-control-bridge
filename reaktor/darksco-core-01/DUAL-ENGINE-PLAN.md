# DARKSCO SPIRAL 01 — Dual Engine Plan

Decision: separate the two Spiral generators into independent sound engines.

## Canonical topology

Spiral A (GROOVE) -> SteamPipe A (PERCUSSION) -> Bus A
Spiral B (BASS/PITCH) -> SteamPipe B (BASS) -> Bus B
Bus A + Bus B -> DARKSCO FX/MIX -> Stereo Out

## Spiral A — GROOVE
- Start from: Bank 2 -> Junkyard Beats 1
- Quant: 1/16
- Objects: 16
- Gate: 0.65
- Clock Divisions: 0.52
- Addition: 0.38
- Spiral: 0.40
- Tilt: 0.25
- Warp: 0.20
- Rnd-A: 0.08
- Sound core: SteamPipe snapshot 76 Percussiator

## Spiral B — BASS / MOTION
- Start from: Bank 2 -> Znagd Pulschord
- Quant: 1/8
- Objects: 5
- Gate: 0.38
- Clock Divisions: 0.40
- Addition: 0.25
- Spiral: 0.50
- Tilt: 0.42
- Warp: 0.55
- Offset: 0.22
- Rnd-A: 0.18
- Root: D
- Scale: Minor
- Sound core: SteamPipe snapshot 52 Dirty Bass

## Mixer / FX
- Percussion bus: HP/LP shaping, mild saturation, short room
- Bass bus: low-pass shaping, saturation, mono-compatible low end
- Shared: stereo delay/reverb sends only after independent engines are stable
- Keep at least -6 dB headroom while building

## Validation order
1. Duplicate SteamPipe 2 to create SteamPipe A/B.
2. Route Spiral A only to SteamPipe A; confirm beat continues.
3. Route Spiral B only to SteamPipe B; confirm bass/melodic layer independently.
4. Mix buses.
5. Add FX.
6. Save snapshot DARKSCO NIGHT 01.

Do not remove or rewire the original working path until each duplicated engine is audible on its own.
