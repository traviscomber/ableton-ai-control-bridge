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


def request_json(url: str, token: str | None, payload: dict | None = None, method: str = "POST") -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Bridge-Token"] = token
    data = None if method == "GET" else json.dumps(payload or {}).encode()
    request = urllib.request.Request(url, data, headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode()) from exc


def send(url: str, token: str | None, payload: dict | None = None) -> dict:
    return request_json(url, token, payload, "POST")


def wait_for_ack(base_url: str, token: str | None, command_id: str, timeout: float) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = request_json(f"{base_url}/api/commands/{command_id}", token, method="GET")
        record = result.get("command", {})
        status = record.get("status")
        if status in {"acknowledged", "simulated"}:
            return result
        if status in {"error", "rejected"}:
            raise RuntimeError(f"{record.get('command_type', 'command')} {status}: {record.get('error') or 'no detail'}")
        time.sleep(0.1)
    raise TimeoutError(f"No Ableton ACK for command {command_id} after {timeout:g}s")


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
    parser.add_argument("--wait-ack", action="store_true", help="Wait for Ableton ACK before sending the next command.")
    parser.add_argument("--ack-timeout", type=float, default=20.0)
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
                record = result.get("command", {})
            if args.wait_ack:
                command_id = record.get("id")
                if not command_id:
                    raise RuntimeError("Bridge returned a command without an id.")
                base_url = args.url.rsplit("/command", 1)[0]
                result = wait_for_ack(base_url, args.token, command_id, args.ack_timeout)
            print(json.dumps(result, separators=(",", ":")))
            if args.delay:
                time.sleep(args.delay)
    print(f"{count} command(s) {'validated' if args.validate_only else 'submitted'}.")


if __name__ == "__main__":
    main()
