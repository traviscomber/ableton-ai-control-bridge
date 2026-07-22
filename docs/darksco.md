# Darksco — AI composer

Darksco is the composition layer of Ableton AI Control Bridge. It writes an
original semantic `SongPlan`; the bridge validates and compiles that plan into
reviewable v0.4 commands. Darksco never bypasses the command allowlist.

## Session modes

| Mode | Behaviour |
| --- | --- |
| `copilot` | Builds one musical block at a time and asks for approval. |
| `producer` | Builds a complete track and asks for one final approval. |
| `autonomous` | Builds, validates and dispatches the complete track. |

Autonomous permission lasts only for the current session. Destructive commands
remain disabled unless the user adds them explicitly to that session's policy.
Transport, mute and solo actions should remain separate approved actions when
working in an important Live Set.

## Musical identity

Darksco develops a small set of motifs through transposition, inversion,
rotation, rhythmic displacement and reharmonisation. Each section changes one
or two musical axes while retaining at least two invariants. Harmony, voice
leading, groove, register, texture, orchestral role, tension and resolution are
planned explicitly. Every track chooses one purposeful creative constraint.

## Safety flow

`brief → SongPlan → validation → command preview → session policy → Live → ACK`

Recommended limits are 64 bars, 12 tracks, 8 scenes and 4096 notes per plan.
Plans store a seed so a composition can be reproduced and revised.

## Minimal plan

```json
{
  "schema": "darksco.song-plan/1.0",
  "session": {"mode": "producer"},
  "meta": {"title": "Night Architecture", "seed": 271828},
  "global": {"bpm": 124, "time_signature": [4, 4], "key": {"tonic": "D", "mode": "dorian"}},
  "sections": [{"id": "intro", "name": "INTRO", "bars": 8, "energy": 0.25}],
  "tracks": [{
    "id": "bass", "name": "Darksco Bass", "role": "bass", "kind": "midi",
    "register": [36, 55], "volume": 0.72, "pan": 0,
    "clips": [{"section": "intro", "name": "Bass — INTRO", "length_beats": 16,
      "loop": true, "notes": [{"pitch": 38, "start": 0, "duration": 0.75, "velocity": 108}]}]
  }]
}
```
