from __future__ import annotations

import argparse
import json
import sys
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a command to the Ableton bridge.")
    parser.add_argument("command", help="JSON command string or path to a .json file.")
    parser.add_argument("--url", default="http://127.0.0.1:8765/command")
    args = parser.parse_args()

    raw = _load_command(args.command)
    req = urllib.request.Request(
        args.url,
        data=raw.encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as response:
        sys.stdout.write(response.read().decode("utf-8"))
        sys.stdout.write("\n")


def _load_command(value: str) -> str:
    if value.endswith(".json"):
        with open(value, "r", encoding="utf-8") as handle:
            return handle.read()
    json.loads(value)
    return value


if __name__ == "__main__":
    main()

