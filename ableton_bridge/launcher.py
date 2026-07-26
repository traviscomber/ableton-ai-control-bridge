from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from tkinter import BOTH, LEFT, RIGHT, Button, Frame, Label, Tk


def application_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def load_config(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError("config.json must contain a JSON object")
    return payload


def health_url(config: dict) -> str:
    host = str(config.get("host", "127.0.0.1"))
    if host == "0.0.0.0":
        host = "127.0.0.1"
    port = int(config.get("port", 8765))
    return f"http://{host}:{port}/health"


def read_health(url: str, timeout: float = 1.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def bridge_command(config_path: Path) -> list[str]:
    if getattr(sys, "frozen", False):
        return [sys.executable, "--bridge-child", "--config", str(config_path)]
    return [sys.executable, "-m", "ableton_bridge.server", "--config", str(config_path)]


def run_bridge_child() -> None:
    from .server import main as server_main

    child_args = sys.argv[2:]
    sys.argv = ["ableton-bridge", *child_args]
    server_main()


class Launcher:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Ableton AI Control Bridge")
        self.root.geometry("540x250")
        self.root.resizable(False, False)

        self.base = application_dir()
        self.config_path = self.base / "config.json"
        self.process: subprocess.Popen[str] | None = None
        self.url = "http://127.0.0.1:8765/health"
        self.dashboard = "http://127.0.0.1:8765"
        self.running = True

        Label(self.root, text="Ableton AI Control Bridge", font=("Segoe UI", 18, "bold")).pack(pady=(22, 6))
        Label(
            self.root,
            text="Load Ableton Live and the receiver .amxd, then keep this launcher open.",
            font=("Segoe UI", 10),
        ).pack(pady=(0, 18))

        self.status = Label(self.root, text="Starting...", font=("Segoe UI", 12))
        self.status.pack(pady=8)
        self.detail = Label(self.root, text="", font=("Segoe UI", 9), wraplength=500)
        self.detail.pack(pady=4)

        actions = Frame(self.root)
        actions.pack(fill=BOTH, padx=28, pady=18)
        Button(actions, text="Open Dashboard", command=self.open_dashboard, width=18).pack(side=LEFT)
        Button(actions, text="Run Check", command=self.refresh_now, width=14).pack(side=LEFT, padx=12)
        Button(actions, text="Stop and Exit", command=self.close, width=14).pack(side=RIGHT)

        self.root.protocol("WM_DELETE_WINDOW", self.close)
        threading.Thread(target=self.start_and_monitor, daemon=True).start()

    def set_status(self, status: str, detail: str) -> None:
        self.root.after(0, lambda: self.status.config(text=status))
        self.root.after(0, lambda: self.detail.config(text=detail))

    def start_and_monitor(self) -> None:
        if not self.config_path.is_file():
            self.set_status("Configuration missing", f"Run the installer first. Missing: {self.config_path}")
            return
        try:
            config = load_config(self.config_path)
            self.url = health_url(config)
            self.dashboard = self.url.rsplit("/health", 1)[0]
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            self.set_status("Configuration error", str(exc))
            return

        health = read_health(self.url)
        if health is None:
            try:
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
                self.process = subprocess.Popen(
                    bridge_command(self.config_path),
                    cwd=str(self.base),
                    creationflags=creationflags,
                    text=True,
                )
            except OSError as exc:
                self.set_status("Bridge failed to start", str(exc))
                return

        for _ in range(40):
            if not self.running:
                return
            health = read_health(self.url)
            if health:
                break
            time.sleep(0.25)
        else:
            self.set_status("Bridge unavailable", f"No health response from {self.url}")
            return

        self.root.after(0, self.open_dashboard)
        while self.running:
            self.update_from_health(read_health(self.url))
            time.sleep(1.0)

    def update_from_health(self, health: dict | None) -> None:
        if health is None:
            self.set_status("Bridge offline", f"No response from {self.url}")
            return
        receiver_seen = bool(health.get("max_receiver_seen"))
        if receiver_seen:
            self.set_status(
                "Ready — Ableton receiver connected",
                f"UDP {health.get('udp_target')} | ACK {health.get('ack_listener')} | Last ACK {health.get('last_ack_at')}",
            )
        else:
            self.set_status(
                "Bridge running — waiting for Ableton",
                "Load the AI Control Bridge Receiver .amxd in Ableton. Readiness appears after the first ACK.",
            )

    def refresh_now(self) -> None:
        threading.Thread(target=lambda: self.update_from_health(read_health(self.url)), daemon=True).start()

    def open_dashboard(self) -> None:
        webbrowser.open(self.dashboard)

    def close(self) -> None:
        self.running = False
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--bridge-child":
        run_bridge_child()
        return
    Launcher().run()


if __name__ == "__main__":
    main()
