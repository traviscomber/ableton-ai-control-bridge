from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, X, Button, Frame, Label, StringVar, Text, Tk, filedialog

from .audio_analysis import analyze_wav, compare_analyses
from .commands import COMMANDS


APP_NAME = "Ableton AI Control Bridge"
HEALTH_URL = "http://127.0.0.1:8765/health"
READ_ONLY_COMPAT_COMMANDS = {"inspect_device_parameters_page"}


def application_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def data_dir() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    path = base / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def _migrate_config(config: dict) -> tuple[dict, bool]:
    """Apply narrow backwards-compatible migrations without widening custom write access."""
    allow = config.get("allow")
    if not isinstance(allow, list):
        return config, False

    allowed = {str(item).strip() for item in allow if str(item).strip()}
    changed = False

    # Existing 0.7.0 installations already allowed device inspection but predated
    # the paged read-only variant. Add only that read-only companion command.
    if {"inspect_device_chain", "inspect_device_parameters"}.issubset(allowed):
        for command in READ_ONLY_COMPAT_COMMANDS:
            if command in COMMANDS and command not in allowed:
                allowed.add(command)
                changed = True

    if changed:
        config = dict(config)
        config["allow"] = sorted(allowed)
    return config, changed


def ensure_config() -> Path:
    path = data_dir() / "config.json"
    if path.exists():
        try:
            config = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            return path
        if isinstance(config, dict):
            config, changed = _migrate_config(config)
            if changed:
                path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return path
    config = {
        "host": "127.0.0.1",
        "port": 8765,
        "udp_host": "127.0.0.1",
        "udp_port": 9001,
        "ack_host": "127.0.0.1",
        "ack_port": 9002,
        "remote_script_host": "127.0.0.1",
        "remote_script_port": 9003,
        "database": str(data_dir() / "history.sqlite3"),
        "token": secrets.token_urlsafe(32),
        "allow": sorted(COMMANDS),
        "require_approval": False,
        "dry_run": False,
    }
    path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return path


def read_health(timeout: float = 1.0) -> dict | None:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return None


class BridgeDesktop:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title(APP_NAME)
        self.root.geometry("860x610")
        self.root.minsize(740, 520)
        self.root.configure(bg="#080a0b")
        self.process: subprocess.Popen[str] | None = None
        self.status = StringVar(value="Bridge stopped")
        self.receiver = StringVar(value="Waiting for Ableton Live 11")
        self.config_path = ensure_config()
        self._build()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        threading.Thread(target=self._monitor, daemon=True).start()

    def _build(self) -> None:
        header = Frame(self.root, bg="#080a0b", padx=26, pady=22)
        header.pack(fill=X)
        Label(header, text="TITAN · ABLETON PRODUCTION SYSTEM", fg="#61f2b5", bg="#080a0b",
              font=("Segoe UI", 18, "bold")).pack(anchor="w")
        Label(header, text="Live 11 bridge · exact-index processing · render analysis · controlled A/B",
              fg="#88949b", bg="#080a0b", font=("Segoe UI", 10)).pack(anchor="w", pady=(5, 0))

        state = Frame(self.root, bg="#14191c", padx=20, pady=16)
        state.pack(fill=X, padx=26, pady=(0, 14))
        Label(state, textvariable=self.status, fg="#ffffff", bg="#14191c",
              font=("Segoe UI", 14, "bold")).pack(anchor="w")
        Label(state, textvariable=self.receiver, fg="#88949b", bg="#14191c",
              font=("Segoe UI", 10)).pack(anchor="w", pady=(5, 0))

        actions = Frame(self.root, bg="#080a0b", padx=26)
        actions.pack(fill=X)
        Button(actions, text="START BRIDGE", command=self.start, bg="#61f2b5", fg="#07120d",
               activebackground="#91ffd5", relief="flat", padx=18, pady=10).pack(side=LEFT)
        Button(actions, text="STOP", command=self.stop, bg="#20262a", fg="#ffffff",
               activebackground="#30383d", relief="flat", padx=18, pady=10).pack(side=LEFT, padx=8)
        Button(actions, text="OPEN TITAN CONSOLE", command=self.open_ui, bg="#f1b84b", fg="#171005",
               activebackground="#ffd477", relief="flat", padx=18, pady=10).pack(side=LEFT)
        Button(actions, text="DIAGNOSTICS", command=self.diagnose, bg="#20262a", fg="#ffffff",
               activebackground="#30383d", relief="flat", padx=18, pady=10).pack(side=RIGHT)

        production = Frame(self.root, bg="#080a0b", padx=26)
        production.pack(fill=X, pady=(10, 0))
        Button(production, text="ANALYZE WAV", command=self.analyze_audio, bg="#20262a", fg="#ffffff",
               activebackground="#30383d", relief="flat", padx=18, pady=9).pack(side=LEFT)
        Button(production, text="A/B WAV", command=self.compare_audio, bg="#20262a", fg="#ffffff",
               activebackground="#30383d", relief="flat", padx=18, pady=9).pack(side=LEFT, padx=8)
        Label(production, text="Offline measurements: peak · RMS · crest · headroom · stereo · spectral ratios",
              fg="#66727a", bg="#080a0b", font=("Segoe UI", 9)).pack(side=LEFT, padx=12)

        Label(self.root, text="Activity", fg="#d7dde1", bg="#080a0b",
              font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=26, pady=(20, 6))
        self.log = Text(self.root, bg="#0b0e10", fg="#b9c5cb", insertbackground="#ffffff",
                        relief="flat", font=("Consolas", 9), padx=12, pady=12)
        self.log.pack(fill=BOTH, expand=True, padx=26, pady=(0, 20))
        self.write("Configuration: " + str(self.config_path))
        self.write("Start the bridge, keep the Receiver loaded in Live 11, then open Titan Console.")
        self.write("Render analysis is offline/read-only and never changes the Live Set.")

    def write(self, message: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        self.log.after(0, lambda: (self.log.insert(END, f"[{stamp}] {message}\n"), self.log.see(END)))

    def start(self) -> None:
        if read_health():
            self.write("Bridge is already running.")
            self.open_ui()
            return
        if self.process and self.process.poll() is None:
            return
        if getattr(sys, "frozen", False):
            command = [sys.executable, "--server", "--config", str(self.config_path)]
        else:
            command = [sys.executable, "-m", "ableton_bridge.gui_server", "--config", str(self.config_path)]
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        self.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                        text=True, creationflags=flags)
        threading.Thread(target=self._read_process, daemon=True).start()
        self.status.set("Starting bridge…")
        self.write("Starting local engine on 127.0.0.1:8765")

    def _read_process(self) -> None:
        if not self.process or not self.process.stdout:
            return
        for line in self.process.stdout:
            self.write(line.rstrip())

    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.process = None
        self.status.set("Bridge stopped")
        self.receiver.set("Waiting for Ableton Live 11")
        self.write("Bridge stopped.")

    def open_ui(self) -> None:
        if not read_health():
            self.start()
            for _ in range(20):
                if read_health():
                    break
                time.sleep(0.1)
        config = json.loads(self.config_path.read_text(encoding="utf-8-sig"))
        webbrowser.open(f"http://127.0.0.1:8765/?token={config['token']}")

    def diagnose(self) -> None:
        health = read_health()
        if not health:
            self.write("ERROR: bridge is not responding. Press START BRIDGE.")
            return
        self.write(f"OK: bridge v{health.get('version')} · {len(health.get('allowed_commands', []))} commands")
        self.write("OK: local authentication enabled" if health.get("authentication_required") else "WARNING: authentication disabled")
        self.write("OK: Ableton acknowledged commands" if health.get("max_receiver_seen") else "WAITING: no ACK from Ableton Receiver")

    def analyze_audio(self) -> None:
        selected = filedialog.askopenfilename(
            title="Select PCM WAV render",
            filetypes=[("WAV audio", "*.wav"), ("All files", "*.*")],
        )
        if not selected:
            return
        threading.Thread(target=self._analyze_audio_worker, args=(Path(selected),), daemon=True).start()

    def _analysis_dir(self) -> Path:
        path = data_dir() / "audio-analysis"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _analyze_audio_worker(self, path: Path) -> None:
        try:
            self.write(f"ANALYZE: {path.name}")
            result = analyze_wav(path)
            output = self._analysis_dir() / f"{path.stem}-analysis.json"
            output.write_text(json.dumps(result, indent=2), encoding="utf-8")
            level = result["level"]
            spectral = result["spectral_balance"]
            correlation = result.get("stereo", {}).get("correlation")
            self.write(
                "RESULT: peak={:.2f} dBFS · RMS={:.2f} dBFS · crest={:.2f} dB · headroom={:.2f} dB".format(
                    level["peak_dbfs"], level["rms_dbfs"], level["crest_db"], level["headroom_db"]
                )
            )
            if correlation is not None:
                self.write(f"STEREO: correlation={correlation:.3f}")
            self.write(
                "SPECTRAL: low={:.3f} · mid={:.3f} · high={:.3f}".format(
                    spectral["low_end_ratio"], spectral["mid_ratio"], spectral["high_ratio"]
                )
            )
            self.write(f"SAVED: {output}")
            self.write("LIMIT: LUFS and true peak are not measured by this first offline layer.")
        except Exception as exc:
            self.write(f"AUDIO ANALYSIS ERROR: {exc}")

    def compare_audio(self) -> None:
        before = filedialog.askopenfilename(
            title="Select BEFORE WAV",
            filetypes=[("WAV audio", "*.wav"), ("All files", "*.*")],
        )
        if not before:
            return
        after = filedialog.askopenfilename(
            title="Select AFTER WAV",
            filetypes=[("WAV audio", "*.wav"), ("All files", "*.*")],
        )
        if not after:
            return
        threading.Thread(target=self._compare_audio_worker, args=(Path(before), Path(after)), daemon=True).start()

    def _compare_audio_worker(self, before: Path, after: Path) -> None:
        try:
            self.write(f"A/B: {before.name} -> {after.name}")
            result = compare_analyses(analyze_wav(before), analyze_wav(after))
            output = self._analysis_dir() / f"{before.stem}__VS__{after.stem}.json"
            output.write_text(json.dumps(result, indent=2), encoding="utf-8")
            delta = result["delta"]
            self.write(
                "DELTA: peak={:+.2f} dB · RMS={:+.2f} dB · crest={:+.2f} dB · low={:+.3f} · high={:+.3f}".format(
                    delta["peak_db"], delta["rms_db"], delta["crest_db"], delta["low_end_ratio"], delta["high_ratio"]
                )
            )
            warnings = result.get("warnings", [])
            self.write("A/B WARNINGS: " + (", ".join(warnings) if warnings else "none from measured safety checks"))
            self.write("A/B DECISION: review required; listen in context before accepting processing.")
            self.write(f"SAVED: {output}")
        except Exception as exc:
            self.write(f"A/B ERROR: {exc}")

    def _monitor(self) -> None:
        while True:
            health = read_health()
            if health:
                self.status.set(f"Bridge active · v{health.get('version', '?')}")
                if health.get("max_receiver_seen"):
                    self.receiver.set("Ableton connected · Receiver acknowledged")
                else:
                    self.receiver.set("Bridge active · load AI Control Bridge Receiver in Live 11")
            elif not self.process or self.process.poll() is not None:
                self.status.set("Bridge stopped")
                self.receiver.set("Waiting for Ableton Live 11")
            time.sleep(1.5)

    def close(self) -> None:
        self.stop()
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    if "--server" in sys.argv:
        sys.argv.remove("--server")
        from .gui_server import main as server_main
        server_main()
        return
    BridgeDesktop().run()


if __name__ == "__main__":
    main()
