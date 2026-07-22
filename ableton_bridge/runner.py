from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from .commands import validate_command


def iter_jsonl(path: str):
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            try:
                payload = json.loads(stripped)
                yield line_number, validate_command(payload)
            except (json.JSONDecodeError, ValueError) as exc:
                raise ValueError(f"{path}:{line_number}: {exc}") from exc


def send(url: str, token: str | None, payload: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Bridge-Token"] = token
    data = json.dumps(payload).encode() if payload is not None else b"{}"
    request = urllib.request.Request(url, data, headers, method="POST")
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode()) from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate or send a JSONL command sequence.")
    parser.add_argument("path")
    parser.add_argument("--url", default="http://127.0.0.1:8765/command")
    parser.add_argument("--token")
    parser.add_argument("--delay", type=float, default=0.0, help="Seconds between commands.")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument(
        "--auto-approve",
        action="store_true",
        help="Explicit autonomous-session permission: approve each submitted command.",
    )
    args = parser.parse_args()
    count = 0
    for line_number, command in iter_jsonl(args.path):
        count += 1
        if args.validate_only:
            print(f"line {line_number}: valid {command['type']}")
        else:
            result = send(args.url, args.token, command)
            record = result.get("command", {})
            if args.auto_approve and record.get("status") == "pending":
                command_id = record.get("id")
                if not command_id:
                    raise RuntimeError("Bridge returned a pending command without an id.")
                base_url = args.url.rsplit("/command", 1)[0]
                result = send(f"{base_url}/api/commands/{command_id}/approve", args.token)
            print(json.dumps(result, separators=(",", ":")))
            if args.delay:
                time.sleep(args.delay)
    print(f"{count} command(s) {'validated' if args.validate_only else 'submitted'}.")


if __name__ == "__main__":
    main()
