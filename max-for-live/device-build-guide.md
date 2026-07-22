# Build and install the Max for Live receiver

The repository contains the editable source:

- `AI-Control-Bridge-Receiver.maxpat`: UDP input/output and device UI.
- `bridge_receiver.js`: complete LiveAPI command mapping and acknowledgements.

## Create the installable `.amxd`

1. Open Ableton Live and add a Max MIDI Effect to a MIDI track.
2. Click the edit button to open the device in Max.
3. Open `AI-Control-Bridge-Receiver.maxpat` from this repository.
4. Confirm the Max Console does not report a missing `bridge_receiver.js`.
5. Choose **File → Save As** and save it as `AI Control Bridge Receiver.amxd`.
6. Keep the `.amxd` and `bridge_receiver.js` together, or freeze the device
   before distributing it so the JavaScript dependency is embedded.
7. Load the saved device into the Live Set.

Max for Live must create the `.amxd`; renaming a text patch to `.amxd` does not
produce a valid installable device.

## Network flow

```text
Python bridge -- JSON/UDP 9001 --> Max receiver
Python bridge <-- JSON/UDP 9002 -- execution acknowledgement
```

Both endpoints use `127.0.0.1` by default.

## Implemented mapping

| Command | Live API operation |
| --- | --- |
| `set_tempo` | Sets `live_set tempo` |
| `launch_scene` | Calls `fire` on `live_set scenes N` |
| `stop_all_clips` | Calls `stop_all_clips` on `live_set` |
| `set_track_volume` | Maps normalized value to mixer volume range |
| `set_track_pan` | Sets mixer panning |
| `set_macro` | Finds Rack `Macro N` and maps normalized value |
| `create_midi_track` | Calls `create_midi_track` and sets its name |
| `create_audio_track` | Calls `create_audio_track` and sets its name |
| `arm_track` | Sets the track `arm` property |
| `set_device_parameter` | Finds device/parameter by exact name and maps value |
| `create_midi_clip` | Creates a clip and writes its MIDI notes |
| `undo` | Calls Live's undo operation |

## Validation checklist in Ableton

Because Max for Live is not available in automated CI, validate the built device
inside a disposable Live Set:

1. Start the bridge with `--require-approval`.
2. Open `http://127.0.0.1:8765`.
3. Send one command of each type.
4. Approve it and confirm its state changes from `sent` to `acknowledged`.
5. Confirm invalid track, scene, device, and parameter references become `error`.
6. Test Undo only after saving a backup of the Live Set.

The implementation uses the documented `LiveAPI` JavaScript object and the Live
Object Model. Parameter lookup by name is case-sensitive, except Rack macro names.
