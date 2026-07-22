from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .commands import CommandError, validate_command
from .transport import UdpTransport


class BridgeState:
    def __init__(self, transport: UdpTransport, dry_run: bool = False):
        self.transport = transport
        self.dry_run = dry_run
        self.command_count = 0
        self.last_command: dict[str, Any] | None = None


def make_handler(state: BridgeState) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "AbletonAIControlBridge/0.1"

        def do_GET(self) -> None:
            if self.path != "/health":
                self._send_json(404, {"ok": False, "error": "Not found"})
                return
            self._send_json(
                200,
                {
                    "ok": True,
                    "dry_run": state.dry_run,
                    "commands_forwarded": state.command_count,
                    "udp_host": state.transport.host,
                    "udp_port": state.transport.port,
                },
            )

        def do_POST(self) -> None:
            if self.path != "/command":
                self._send_json(404, {"ok": False, "error": "Not found"})
                return

            try:
                payload = self._read_json()
                command = validate_command(payload)
                state.last_command = command
                if not state.dry_run:
                    state.transport.send(command)
                state.command_count += 1
            except (CommandError, json.JSONDecodeError) as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})
                return

            self._send_json(202, {"ok": True, "forwarded": not state.dry_run, "command": command})

        def log_message(self, format: str, *args: Any) -> None:
            return

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise CommandError("Request body must be a JSON object.")
            return payload

        def _send_json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, indent=2).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Ableton AI Control Bridge.")
    parser.add_argument("--host", default="127.0.0.1", help="HTTP host to bind.")
    parser.add_argument("--port", default=8765, type=int, help="HTTP port to bind.")
    parser.add_argument("--udp-host", default="127.0.0.1", help="Max for Live UDP host.")
    parser.add_argument("--udp-port", default=9001, type=int, help="Max for Live UDP port.")
    parser.add_argument("--dry-run", action="store_true", help="Validate commands without forwarding UDP.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    state = BridgeState(UdpTransport(args.udp_host, args.udp_port), dry_run=args.dry_run)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    print(f"Ableton AI Control Bridge listening on http://{args.host}:{args.port}")
    print(f"Forwarding UDP to {args.udp_host}:{args.udp_port} dry_run={args.dry_run}")
    server.serve_forever()


if __name__ == "__main__":
    main()

