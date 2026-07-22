from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a command to the Ableton bridge.")
    parser.add_argument("command", help="JSON command string or path to a .json file.")
    parser.add_argument("--url", default="http://127.0.0.1:8765/command")
    parser.add_argument("--token", default=os.environ.get("ABLETON_BRIDGE_TOKEN"))
    args = parser.parse_args()

    raw = _load_command(args.command)
    headers = {"Content-Type": "application/json"}
    if args.token:
        headers["X-Bridge-Token"] = args.token
    req = urllib.request.Request(
        args.url,
        data=raw.encode("utf-8"),
        headers=headers,
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
