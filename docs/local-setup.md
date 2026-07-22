# Local Setup

## 1. Run the Python Bridge

```bash
cd ableton-ai-control-bridge
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
python -m ableton_bridge.server --token "change-this-token" --require-approval
```

Windows PowerShell:

```powershell
cd ableton-ai-control-bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
python -m ableton_bridge.server --token "change-this-token" --require-approval
```

## 2. Build the Max for Live Device

Open `max-for-live/device-build-guide.md` and create the device in Max for Live.

Open `max-for-live/AI-Control-Bridge-Receiver.maxpat` in Max for Live,
confirm that `bridge_receiver.js` is found, and use **Save As** to create
`AI Control Bridge Receiver.amxd`. The device listens on UDP `9001` and
returns acknowledgements to UDP `9002`.

## 3. Test

```bash
python -m ableton_bridge.cli --token "change-this-token" '{"type":"set_tempo","bpm":132}'
ableton-bridge-run examples/commands/neon_basement_ritual.jsonl --token "change-this-token" --validate-only
```

## 4. AI Workflow

Ask the assistant for commands:

```text
Create commands for Ableton. Tempo 132. Track 1 bass macro 1 opens during bars 33-49. Return JSONL only.
```

Paste or pipe those commands to the bridge.

Open `http://127.0.0.1:8765` to review, approve, reject, inspect, or undo
commands. Enter the local token in the UI when authentication is active.
