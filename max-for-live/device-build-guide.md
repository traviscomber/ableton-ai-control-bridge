# Max for Live Device Build Guide

Create a new Max MIDI Effect named:

```text
AI Control Bridge Receiver.amxd
```

## Objects

Use these core objects:

```text
[udpreceive 9001]
[fromsymbol]
[dict.deserialize]
[dict route type]
```

Then route command types:

```text
[route set_tempo launch_scene stop_all_clips set_macro set_track_volume set_track_pan create_midi_clip]
```

## Live API Targets

Use Max's `live.path`, `live.object`, and `live.observer` objects.

Common paths:

```text
live_set
live_set tracks N
live_set scenes N
live_set tracks N devices M
live_set tracks N mixer_device volume
live_set tracks N mixer_device panning
```

## Command Mapping

### set_tempo

Path:

```text
live_set
```

Set property:

```text
tempo BPM
```

### launch_scene

Path:

```text
live_set scenes SCENE_INDEX
```

Call:

```text
fire
```

### stop_all_clips

Path:

```text
live_set
```

Call:

```text
stop_all_clips
```

### set_macro

Path:

```text
live_set tracks TRACK_INDEX devices 0 parameters MACRO_INDEX
```

Set:

```text
value NORMALIZED_VALUE
```

Note: Live parameters may expose native ranges. Start by mapping normalized 0-1 values through a `scale 0. 1. MIN MAX` object.

### create_midi_clip

Target:

```text
live_set tracks TRACK_INDEX clip_slots CLIP_INDEX
```

Call:

```text
create_clip LENGTH_IN_BEATS
```

Then use the clip object to add notes with Live's note API.

## Practical MVP

For the first working version, implement:

1. `set_tempo`
2. `launch_scene`
3. `stop_all_clips`
4. `set_track_volume`
5. `set_macro`

Then add clip creation after the transport is stable.

