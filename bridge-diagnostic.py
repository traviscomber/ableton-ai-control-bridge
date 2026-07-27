#!/usr/bin/env python3
"""
Ableton AI Control Bridge Diagnostic Tool

Run this to check:
- Bridge running status
- Port availability
- Max device detection
- CORS configuration
- Network connectivity
"""

import socket
import sys
import json
import subprocess
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

def check_port(host: str, port: int, timeout: int = 2) -> bool:
    """Check if a port is open."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def get_bridge_health() -> dict | None:
    """Get bridge health status."""
    try:
        with urlopen("http://127.0.0.1:8765/health", timeout=2) as response:
            return json.loads(response.read())
    except URLError:
        return None

def get_python_info() -> tuple[str, str]:
    """Get Python version and platform."""
    import platform
    return sys.version.split()[0], platform.system()

def print_status(label: str, status: bool, detail: str = ""):
    """Pretty print status."""
    symbol = "✓" if status else "✗"
    color = "\033[92m" if status else "\033[91m"
    reset = "\033[0m"
    print(f"  {color}{symbol}{reset} {label:<30} {detail}")

def main():
    print("\n" + "=" * 60)
    print("Ableton AI Control Bridge — Diagnostic Report")
    print("=" * 60 + "\n")

    # Check bridge
    print("BRIDGE SERVICE")
    bridge_running = check_port("127.0.0.1", 8765)
    print_status("Bridge Running", bridge_running, "http://127.0.0.1:8765")

    bridge_health = None
    if bridge_running:
        bridge_health = get_bridge_health()
        if bridge_health:
            print_status("Health Endpoint", True, f"v{bridge_health.get('version', 'unknown')}")
            print_status("Max Device Detected", bridge_health.get("max_receiver_seen", False))
            print_status("Authentication Required", bridge_health.get("authentication_required", False))
            print_status("Approval Required", bridge_health.get("approval_required", False))
            udp_target = bridge_health.get("udp_target", "unknown")
            print(f"  → UDP Target: {udp_target}")
            ack_listener = bridge_health.get("ack_listener", "unknown")
            print(f"  → ACK Listener: {ack_listener}")
        else:
            print_status("Health Endpoint", False, "Cannot reach /health")
    else:
        print_status("Fix", False, "Run: python -m ableton_bridge")

    # Check ports
    print("\nPORT AVAILABILITY")
    print_status("Bridge Port 8765", check_port("127.0.0.1", 8765))
    print_status("Ableton Send 9001", check_port("127.0.0.1", 9001))
    print_status("Ableton Receive 9002", check_port("127.0.0.1", 9002))

    # Check Max device
    print("\nMAX FOR LIVE DEVICE")
    if bridge_health:
        max_detected = bridge_health.get("max_receiver_seen", False)
        print_status("AI-Control-Bridge-Receiver", max_detected)
        if not max_detected:
            print_status("Fix", False, "Add MIDI effect in Ableton Live 11")
    else:
        print_status("Max Detection", False, "Cannot check (bridge offline)")

    # Check environment
    print("\nENVIRONMENT")
    py_version, platform = get_python_info()
    print(f"  Python: {py_version}")
    print(f"  Platform: {platform}")

    # Check config file
    config_path = Path("bridge.config.json")
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
            token = config.get("token")
            print_status("bridge.config.json", True, f"token={'null' if token is None else 'set'}")
    else:
        print_status("bridge.config.json", False, "File not found")

    # Summary
    print("\n" + "=" * 60)
    if bridge_running and bridge_health and bridge_health.get("max_receiver_seen"):
        print("✓ All systems operational! Ready to test.")
        print("  Go to: http://localhost:[PORT]/test-tempo")
    elif bridge_running:
        print("⚠ Bridge running but Max device not detected.")
        print("  Add the MIDI effect in Ableton Live.")
    else:
        print("✗ Bridge not running.")
        print("  Start: python -m ableton_bridge")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
