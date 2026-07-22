# Local Setup

## 1. Run the Python Bridge

```bash
cd ableton-ai-control-bridge
python -m venv .venv
source .venv/bin/activate
python -m ableton_bridge.server
```

Windows PowerShell:

```powershell
cd ableton-ai-control-bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m ableton_bridge.server
```

## 2. Build the Max for Live Device

Open `max-for-live/device-build-guide.md` and create the device in Max for Live.

The device should listen on UDP port `9001`.

## 3. Test

```bash
python -m ableton_bridge.cli '{"type":"set_tempo","bpm":132}'
python -m ableton_bridge.cli '{"type":"set_macro","track":1,"macro":1,"value":0.8}'
```

## 4. AI Workflow

Ask the assistant for commands:

```text
Create commands for Ableton. Tempo 132. Track 1 bass macro 1 opens during bars 33-49. Return JSONL only.
```

Paste or pipe those commands to the bridge.

