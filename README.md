# Ableton AI Control Bridge

Local bridge for controlling Ableton Live from AI-generated commands.

The bridge is designed for a workflow like:

```text
Codex / assistant -> local HTTP bridge -> UDP messages -> Max for Live device -> Ableton Live
```

It does not require third-party VSTs. The first MVP focuses on a simple, inspectable protocol that can control tempo, scenes, tracks, clips, and rack macros.

## Status

MVP scaffold. The Python bridge is functional. The Max for Live side is specified as a build guide because `.amxd` devices must be saved from Ableton/Max.

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
python -m ableton_bridge.server
```

The server starts on:

```text
http://127.0.0.1:8765
```

Health check:

```bash
curl http://127.0.0.1:8765/health
```

Send a command:

```bash
curl -X POST http://127.0.0.1:8765/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set_tempo","bpm":132}'
```

## Commands

See:

- `docs/protocol.md`
- `examples/commands/neon_basement_ritual.jsonl`

## Project Goals

- Let an AI assistant create and modify Ableton arrangements through explicit commands.
- Keep every action human-readable before execution.
- Avoid fake Ableton project files or unstable reverse-engineered `.als` output.
- Support Max for Live first, Remote Scripts second.

## Safety Model

The bridge is local-only by default. It binds to `127.0.0.1`, not your public network.

Commands are JSON. The first version validates command types and ranges before forwarding them to Ableton.

## Repository Layout

```text
ableton_bridge/          Python bridge package
examples/commands/       Example command scripts
max-for-live/            Max for Live build guide and message map
docs/                    Protocol and setup docs
tests/                   Lightweight stdlib tests
```

