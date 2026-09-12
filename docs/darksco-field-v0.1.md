# DARKSCO FIELD v0.1

Status: source scaffold. Not yet runtime-verified in Ableton Live.

## Purpose

FIELD is the first DARKSCO-owned sound instrument in the Ableton AI Control Bridge project. It is designed as a dense evolving voice field rather than a preset for an Ableton stock synth.

The first integration deliberately reuses the stable bridge command `set_device_parameter`. No new HTTP/UDP/Max receiver command is introduced in v0.1.

```text
DARKSCO musical intent
        |
        v
FIELD semantic controls
        |
        v
set_device_parameter
        |
        v
HTTP -> UDP -> Max receiver -> LiveAPI
        |
        v
DARKSCO FIELD device
```

## Public controls

All values are normalized 0..1.

| Semantic control | Max/Live parameter | Intent |
| --- | --- | --- |
| `density` | `Density` | Number/weight of active voices |
| `spread` | `Spread` | Spectral/stereo dispersion |
| `motion` | `Motion` | Rate/depth of evolving modulation |
| `instability` | `Instability` | Controlled detune and stochastic drift |
| `texture` | `Texture` | Harmonic/noise character |
| `space` | `Space` | Spatial depth and diffusion |

`seed` and controlled randomization are intentionally deferred until the device state model is implemented; they must be deterministic before becoming public AI controls.

## Compatibility rule

FIELD v0.1 compiles semantic state to existing `set_device_parameter` commands. This keeps `ableton_bridge/commands.py`, `max-for-live/bridge_receiver.js`, and the existing receiver device unchanged.

Example:

```python
from darksco.instruments.field import compile_field_state

commands = compile_field_state(
    {"density": 0.72, "motion": 0.31, "space": 0.65},
    track_ref="field-1",
)
```

## DSP target for the Max device

The first audible prototype should target 64 voices and expose the six public parameters above. The intended signal model is:

```text
MIDI / held pitch / root
  -> voice distribution
  -> oscillator bank
  -> controlled detune/drift
  -> spectral/noise texture
  -> stereo/spatial diffusion
  -> safety gain stage
```

The v0.1 device must use stock Max/MSP objects available with the Live 11 Max for Live environment unless a dependency is explicitly approved and packaged.

## Safety and release gates

1. Python semantic compiler tests pass.
2. Existing bridge tests remain green.
3. Max source opens without console errors.
4. Parameters are exposed with exact stable names.
5. Device is saved under a versioned FIELD filename; do not overwrite the current receiver.
6. Audible smoke test uses a disposable Live Set.
7. CPU is measured with 64 voices before considering 128 voices.
8. Packaged `.amxd` is reopened and tested in Ableton Live 11 before runtime certification.

## Explicit non-claims

This source scaffold does not prove that FIELD produces audio, that an `.amxd` has been rebuilt, or that Ableton Live 11 runtime behavior has been verified. Those are subsequent gates requiring Max/Ableton runtime evidence.
