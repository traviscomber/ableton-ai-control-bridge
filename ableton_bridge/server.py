from __future__ import annotations

import argparse
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .commands import COMMANDS, CommandError, validate_command
from .security import AccessPolicy
from .store import CommandStore
from .transport import AckListener, UdpTransport


class BridgeState:
    def __init__(
        self,
        transport: UdpTransport,
        store: CommandStore,
        policy: AccessPolicy,
        *,
        dry_run: bool = False,
        require_approval: bool = False,
        ack_host: str = "127.0.0.1",
        ack_port: int = 9002,
    ):
        self.transport = transport
        self.store = store
        self.policy = policy
        self.dry_run = dry_run
        self.require_approval = require_approval
        self.ack_host = ack_host
        self.ack_port = ack_port
        self.last_ack_at: str | None = None

    def submit(self, payload: dict[str, Any], source: str) -> dict[str, Any]:
        command = validate_command(payload)
        if not self.policy.allows(command["type"]):
            raise PermissionError(f"Command type is not allowed in this session: {command['type']}")
        status = "pending" if self.require_approval else "accepted"
        record = self.store.create(command, status, source)
        return record if self.require_approval else self.dispatch(record)

    def dispatch(self, record: dict[str, Any]) -> dict[str, Any]:
        if record["status"] not in ("accepted", "pending"):
            raise CommandError(f"Command cannot be dispatched from status: {record['status']}")
        if self.dry_run:
            return self.store.update(record["id"], "simulated", result={"forwarded": False}) or record
        envelope = dict(record["payload"])
        envelope["bridge_id"] = record["id"]
        envelope["ack_host"] = self.ack_host
        envelope["ack_port"] = self.ack_port
        try:
            self.transport.send(envelope)
        except OSError as exc:
            return self.store.update(record["id"], "error", error=str(exc)) or record
        return self.store.update(record["id"], "sent", result={"forwarded": True}) or record

    def approve(self, command_id: str) -> dict[str, Any]:
        record = self.store.get(command_id)
        if not record:
            raise KeyError(command_id)
        return self.dispatch(record)

    def reject(self, command_id: str) -> dict[str, Any]:
        record = self.store.get(command_id)
        if not record:
            raise KeyError(command_id)
        if record["status"] != "pending":
            raise CommandError("Only pending commands can be rejected.")
        return self.store.update(command_id, "rejected") or record

    def undo(self, command_id: str, source: str) -> dict[str, Any]:
        target = self.store.get(command_id)
        if not target:
            raise KeyError(command_id)
        if target["status"] not in ("sent", "acknowledged"):
            raise CommandError("Only sent or acknowledged commands can be undone.")
        undo_record = self.store.create({"type": "undo", "target_command_id": command_id}, "accepted", source)
        if self.dry_run:
            return self.store.update(undo_record["id"], "simulated", undo_of=command_id) or undo_record
        envelope = dict(undo_record["payload"])
        envelope.update({"bridge_id": undo_record["id"], "ack_host": self.ack_host, "ack_port": self.ack_port})
        self.transport.send(envelope)
        return self.store.update(undo_record["id"], "sent", undo_of=command_id) or undo_record

    def receive_acknowledgements(self) -> None:
        listener = AckListener(self.ack_host, self.ack_port)
        while True:
            try:
                message = listener.receive()
                if not message or not isinstance(message.get("bridge_id"), str):
                    continue
                ok = message.get("ok") is True
                self.last_ack_at = datetime.now(timezone.utc).isoformat()
                self.store.update(
                    message["bridge_id"],
                    "acknowledged" if ok else "error",
                    result=message.get("result"),
                    error=None if ok else str(message.get("error", "Ableton execution failed")),
                )
            except (OSError, ValueError, json.JSONDecodeError):
                continue


def make_handler(state: BridgeState) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "AbletonAIControlBridge/0.2"

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send_html(APPROVAL_UI)
                return
            if parsed.path == "/health":
                self._send_json(200, {
                    "ok": True,
                    "version": "0.4.0",
                    "dry_run": state.dry_run,
                    "approval_required": state.require_approval,
                    "authentication_required": bool(state.policy.token),
                    "allowed_commands": sorted(state.policy.allowed or COMMANDS),
                    "udp_target": f"{state.transport.host}:{state.transport.port}",
                    "ack_listener": f"{state.ack_host}:{state.ack_port}",
                    "max_receiver_seen": state.last_ack_at is not None,
                    "last_ack_at": state.last_ack_at,
                })
                return
            if parsed.path == "/api/commands":
                if not self._authorized():
                    return
                query = parse_qs(parsed.query)
                status = query.get("status", [None])[0]
                limit = int(query.get("limit", ["100"])[0])
                self._send_json(200, {"ok": True, "commands": state.store.list(status=status, limit=limit)})
                return
            self._send_json(404, {"ok": False, "error": "Not found"})

        def do_POST(self) -> None:
            if not self._authorized():
                return
            parsed = urlparse(self.path)
            try:
                if parsed.path == "/command":
                    record = state.submit(self._read_json(), self.client_address[0])
                    self._send_json(202, {"ok": True, "command": record})
                    return
                parts = parsed.path.strip("/").split("/")
                if len(parts) == 4 and parts[:2] == ["api", "commands"]:
                    command_id, action = parts[2], parts[3]
                    if action == "approve":
                        record = state.approve(command_id)
                    elif action == "reject":
                        record = state.reject(command_id)
                    elif action == "undo":
                        record = state.undo(command_id, self.client_address[0])
                    else:
                        raise KeyError(action)
                    self._send_json(202, {"ok": True, "command": record})
                    return
                self._send_json(404, {"ok": False, "error": "Not found"})
            except PermissionError as exc:
                self._send_json(403, {"ok": False, "error": str(exc)})
            except KeyError:
                self._send_json(404, {"ok": False, "error": "Command not found"})
            except (CommandError, json.JSONDecodeError, ValueError) as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})

        def _authorized(self) -> bool:
            supplied = self.headers.get("X-Bridge-Token")
            authorization = self.headers.get("Authorization", "")
            if not supplied and authorization.startswith("Bearer "):
                supplied = authorization[7:]
            if state.policy.authorize(supplied):
                return True
            self._send_json(401, {"ok": False, "error": "Missing or invalid bridge token"})
            return False

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

        def _send_html(self, body: str) -> None:
            encoded = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, format: str, *args: Any) -> None:
            return

    return Handler


def build_parser(defaults: dict[str, Any] | None = None) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Ableton AI Control Bridge.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--udp-host", default="127.0.0.1")
    parser.add_argument("--udp-port", default=9001, type=int)
    parser.add_argument("--ack-host", default="127.0.0.1")
    parser.add_argument("--ack-port", default=9002, type=int)
    parser.add_argument("--database", default=".ableton-bridge/history.sqlite3")
    parser.add_argument("--token", default=os.environ.get("ABLETON_BRIDGE_TOKEN"))
    parser.add_argument("--allow", help="Comma-separated command allowlist.")
    parser.add_argument("--require-approval", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--config", help="Path to a JSON configuration file.")
    if defaults:
        parser.set_defaults(**defaults)
    return parser


def load_config(path: str) -> dict[str, Any]:
    try:
        # utf-8-sig accepts the BOM written by Windows PowerShell 5.1.
        defaults = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot load config file: {exc}") from exc
    if not isinstance(defaults, dict):
        raise ValueError("Config file must contain a JSON object.")
    return defaults


def main() -> None:
    config_parser = argparse.ArgumentParser(add_help=False)
    config_parser.add_argument("--config")
    config_arg, _ = config_parser.parse_known_args()
    defaults: dict[str, Any] = {}
    if config_arg.config:
        try:
            defaults = load_config(config_arg.config)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
    args = build_parser(defaults).parse_args()
    allow_value = args.allow
    if isinstance(allow_value, list):
        allowed = {str(item).strip() for item in allow_value if str(item).strip()}
    else:
        allowed = {item.strip() for item in allow_value.split(",") if item.strip()} if allow_value else None
    unknown = allowed - set(COMMANDS) if allowed else set()
    if unknown:
        raise SystemExit(f"Unknown command(s) in --allow: {', '.join(sorted(unknown))}")
    state = BridgeState(
        UdpTransport(args.udp_host, args.udp_port),
        CommandStore(args.database),
        AccessPolicy(args.token, allowed),
        dry_run=args.dry_run,
        require_approval=args.require_approval,
        ack_host=args.ack_host,
        ack_port=args.ack_port,
    )
    if not args.dry_run:
        threading.Thread(target=state.receive_acknowledgements, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    print(f"Ableton AI Control Bridge v0.4 listening on http://{args.host}:{args.port}")
    print(f"UDP target={args.udp_host}:{args.udp_port} ack={args.ack_host}:{args.ack_port}")
    print(f"dry_run={args.dry_run} approval={args.require_approval} auth={bool(args.token)}")
    server.serve_forever()


APPROVAL_UI = r'''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ableton AI Control Bridge</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui;background:#111;color:#eee}body{max-width:1100px;margin:0 auto;padding:32px}h1{font-size:28px}header{display:flex;gap:16px;align-items:center;justify-content:space-between}input{background:#202020;border:1px solid #444;color:#fff;padding:10px;border-radius:8px}.card{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin:12px 0}.meta{color:#aaa;font-size:12px}.status{color:#55e39f}pre{white-space:pre-wrap;color:#d7d7d7}button{border:0;border-radius:8px;padding:9px 14px;margin-right:8px;cursor:pointer}.approve{background:#55e39f}.reject{background:#ff6b6b}.undo{background:#ffc857}#error{color:#ff6b6b}
</style>
<body><header><div><h1>Ableton AI Control Bridge</h1><p>Approval queue and command history</p></div><input id="token" type="password" placeholder="Local bridge token"></header><p id="error"></p><main id="list"></main>
<script>
const token=document.querySelector('#token');token.value=localStorage.bridgeToken||'';token.onchange=()=>{localStorage.bridgeToken=token.value;load()};
const headers=()=>({'X-Bridge-Token':token.value});
async function action(id,name){await fetch(`/api/commands/${id}/${name}`,{method:'POST',headers:headers()});load()}
async function load(){try{const r=await fetch('/api/commands?limit=100',{headers:headers()});const data=await r.json();if(!r.ok)throw Error(data.error);document.querySelector('#error').textContent='';document.querySelector('#list').innerHTML=data.commands.map(c=>`<section class="card"><div><b>${c.command_type}</b> · <span class="status">${c.status}</span></div><div class="meta">${c.created_at} · ${c.id}</div><pre>${JSON.stringify(c.payload,null,2)}</pre>${c.error?`<p id="error">${c.error}</p>`:''}${c.status==='pending'?`<button class="approve" onclick="action('${c.id}','approve')">Approve</button><button class="reject" onclick="action('${c.id}','reject')">Reject</button>`:''}${['sent','acknowledged'].includes(c.status)?`<button class="undo" onclick="action('${c.id}','undo')">Undo</button>`:''}</section>`).join('')||'<p>No commands yet.</p>'}catch(e){document.querySelector('#error').textContent=e.message}}
load();setInterval(load,2000);
</script></body></html>'''


if __name__ == "__main__":
    main()
