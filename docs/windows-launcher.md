# One-click Windows launcher

The launcher provides a simple operator flow for the existing Ableton AI Control Bridge.

## What it does

1. Reads `config.json` from the same folder as the launcher.
2. Starts the existing Python bridge when it is not already running.
3. Opens the local bridge dashboard.
4. Monitors `/health` once per second.
5. Shows whether the bridge is waiting for Ableton or has received an ACK from the Max for Live receiver.
6. Stops only the bridge process that it started when the launcher exits.

It does not launch Ableton, insert the `.amxd`, modify a Live Set, or replace the existing bridge executable and scripts.

## Build the EXE

From the installed Windows package, double-click:

```text
windows\BUILD LAUNCHER.cmd
```

Or run:

```powershell
.\windows\build-launcher.ps1
```

The output is:

```text
dist\Ableton Bridge Launcher.exe
```

PyInstaller is installed into the project's existing virtual environment during the build.

## Use

1. Keep `Ableton Bridge Launcher.exe` beside `config.json` in the installed package root.
2. Open Ableton Live 11.
3. Load the existing receiver `.amxd` on a MIDI track.
4. Double-click `Ableton Bridge Launcher.exe`.
5. Wait for the launcher to show `Ready — Ableton receiver connected` after the receiver sends an ACK.

The first ready state may require one harmless bridge command because the current health endpoint records whether an ACK has been observed during the running bridge process.

## Compatibility and preservation

- The launcher uses the same server, configuration, ports, token, allowlist, approval mode, SQLite history, and Max receiver as the existing workflow.
- Existing `.cmd` launchers remain valid fallbacks.
- The `.amxd` is not changed or embedded in the EXE.
- The launcher does not overwrite or rebuild the device.
