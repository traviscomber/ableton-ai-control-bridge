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

from .commands import COMMANDS, REMOTE_SCRIPT_COMMANDS, CommandError, validate_command
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
        remote_transport: UdpTransport | None = None,
    ):
        self.transport = transport
        self.store = store
        self.policy = policy
        self.dry_run = dry_run
        self.require_approval = require_approval
        self.ack_host = ack_host
        self.ack_port = ack_port
        self.remote_transport = remote_transport
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
            transport = (
                self.remote_transport
                if envelope.get("type") in REMOTE_SCRIPT_COMMANDS
                else self.transport
            )
            if transport is None:
                raise OSError("Remote Script transport is not configured")
            transport.send(envelope)
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
        server_version = "AbletonAIControlBridge/0.7"

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send_html(APPROVAL_UI)
                return
            if parsed.path == "/health":
                self._send_json(200, {
                    "ok": True,
                    "version": "0.7.0",
                    "dry_run": state.dry_run,
                    "approval_required": state.require_approval,
                    "authentication_required": bool(state.policy.token),
                    "allowed_commands": sorted(state.policy.allowed or COMMANDS),
                    "udp_target": f"{state.transport.host}:{state.transport.port}",
                    "remote_script_target": (
                        f"{state.remote_transport.host}:{state.remote_transport.port}"
                        if state.remote_transport else None
                    ),
                    "ack_listener": f"{state.ack_host}:{state.ack_port}",
                    "max_receiver_seen": state.last_ack_at is not None,
                    "last_ack_at": state.last_ack_at,
                    "private_network_access": True,
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
            parts = parsed.path.strip("/").split("/")
            if len(parts) == 3 and parts[:2] == ["api", "commands"]:
                if not self._authorized():
                    return
                record = state.store.get(parts[2])
                if not record:
                    self._send_json(404, {"ok": False, "error": "Command not found"})
                    return
                self._send_json(200, {"ok": True, "command": record})
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

        def do_OPTIONS(self) -> None:
            """Handle CORS and Chrome Private Network Access preflight."""
            self.send_response(204)
            self._cors_headers()
            self.send_header("Access-Control-Max-Age", "86400")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _cors_headers(self) -> None:
            origin = self.headers.get("Origin") or "*"
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Bridge-Token,Authorization")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Cross-Origin-Resource-Policy", "cross-origin")

        def _send_json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, indent=2).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors_headers()
            self.end_headers()
            self.wfile.write(body)

        def _send_html(self, body: str) -> None:
            encoded = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self._cors_headers()
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
    parser.add_argument("--remote-script-host", default="127.0.0.1")
    parser.add_argument("--remote-script-port", default=9003, type=int)
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
        remote_transport=UdpTransport(args.remote_script_host, args.remote_script_port),
    )
    if not args.dry_run:
        threading.Thread(target=state.receive_acknowledgements, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    print(f"Ableton AI Control Bridge v0.7.0 listening on http://{args.host}:{args.port}")
    print(f"UDP target={args.udp_host}:{args.udp_port} ack={args.ack_host}:{args.ack_port}")
    print(f"Remote Script target={args.remote_script_host}:{args.remote_script_port}")
    print(f"dry_run={args.dry_run} approval={args.require_approval} auth={bool(args.token)}")
    server.serve_forever()


APPROVAL_UI = r'''<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Darksco · Ableton AI Control Bridge</title>
<style>
:root{color-scheme:dark;font-family:Inter,Segoe UI,system-ui;background:#0d0f10;color:#eee}*{box-sizing:border-box}body{max-width:1180px;margin:0 auto;padding:32px}h1{font-size:28px;margin:0}.eyebrow{color:#63f5bd;font-size:12px;letter-spacing:.12em;font-weight:700}header{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:22px}input,select,textarea{background:#191d20;border:1px solid #394147;color:#fff;padding:10px;border-radius:8px}.token{width:260px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric,.composer,.card{background:#171a1c;border:1px solid #30363a;border-radius:12px;padding:16px}.metric b{display:block;font-size:20px;margin-top:6px}.composer{margin:14px 0}.composer-row{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.composer label{font-size:12px;color:#aab3b8;display:flex;flex-direction:column;gap:5px}.composer textarea{width:100%;min-height:74px;margin-top:10px;font-family:Consolas,monospace}.card{margin:12px 0}.meta{color:#929da3;font-size:12px}.status{color:#63f5bd}pre{white-space:pre-wrap;color:#d7d7d7}button{border:0;border-radius:8px;padding:10px 14px;margin-right:8px;cursor:pointer;font-weight:650}.primary,.approve{background:#63f5bd;color:#07110d}.reject{background:#ff6b6b}.undo{background:#ffc857;color:#181008}#error{color:#ff6b6b}.muted{color:#929da3}@media(max-width:760px){.grid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}.token{width:100%}}
</style>
<body><header><div><div class="eyebrow">DARKSCO CONTROL SYSTEM</div><h1>Ableton AI Control Bridge</h1><p class="muted">Control local, historial y ejecución autónoma para Live 11</p></div><input class="token" id="token" type="password" placeholder="Token local"></header>
<section class="grid"><div class="metric">Bridge<b id="bridgeState">Comprobando…</b></div><div class="metric">Ableton Receiver<b id="receiverState">Comprobando…</b></div><div class="metric">Modo<b id="modeState">Comprobando…</b></div></section>
<section class="composer"><div class="composer-row"><label>Comando<select id="commandType"><option>set_tempo</option><option>start_playback</option><option>stop_playback</option><option>create_midi_track</option><option>create_scene</option><option>stop_all_clips</option></select></label><label>Tempo<input id="bpm" type="number" min="20" max="999" value="124"></label><button class="primary" onclick="sendCommand()">EJECUTAR</button><button onclick="load()">ACTUALIZAR</button></div><textarea id="jsonCommand" spellcheck="false">{"type":"set_tempo","bpm":124}</textarea><p class="muted">Puedes editar el JSON para utilizar cualquiera de los comandos permitidos.</p></section>
<p id="error"></p><h2>Actividad reciente</h2><main id="list"></main>
<script>
const params=new URLSearchParams(location.search);const token=document.querySelector('#token');token.value=params.get('token')||localStorage.bridgeToken||'';if(params.get('token')){localStorage.bridgeToken=token.value;history.replaceState({},'',location.pathname)}token.onchange=()=>{localStorage.bridgeToken=token.value;load()};
const headers=()=>({'X-Bridge-Token':token.value});
async function action(id,name){await fetch(`/api/commands/${id}/${name}`,{method:'POST',headers:headers()});load()}
const type=document.querySelector('#commandType'),bpm=document.querySelector('#bpm'),jsonBox=document.querySelector('#jsonCommand');type.onchange=()=>{jsonBox.value=type.value==='set_tempo'?JSON.stringify({type:type.value,bpm:Number(bpm.value)}):JSON.stringify({type:type.value})};bpm.oninput=()=>{if(type.value==='set_tempo')type.onchange()};
async function sendCommand(){try{const payload=JSON.parse(jsonBox.value);const r=await fetch('/command',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error);document.querySelector('#error').textContent='';load()}catch(e){document.querySelector('#error').textContent=e.message}}
async function load(){try{const h=await fetch('/health').then(r=>r.json());document.querySelector('#bridgeState').textContent=`Activo · v${h.version}`;document.querySelector('#receiverState').textContent=h.max_receiver_seen?'Conectado':'Esperando Live';document.querySelector('#modeState').textContent=h.approval_required?'Con aprobación':'Autónomo';const r=await fetch('/api/commands?limit=100',{headers:headers()});const data=await r.json();if(!r.ok)throw Error(data.error);document.querySelector('#error').textContent='';document.querySelector('#list').innerHTML=data.commands.map(c=>`<section class="card"><div><b>${c.command_type}</b> · <span class="status">${c.status}</span></div><div class="meta">${c.created_at} · ${c.id}</div><pre>${JSON.stringify(c.payload,null,2)}</pre>${c.error?`<p id="error">${c.error}</p>`:''}${c.status==='pending'?`<button class="approve" onclick="action('${c.id}','approve')">Aprobar</button><button class="reject" onclick="action('${c.id}','reject')">Rechazar</button>`:''}${['sent','acknowledged'].includes(c.status)?`<button class="undo" onclick="action('${c.id}','undo')">Undo</button>`:''}</section>`).join('')||'<p class="muted">Todavía no hay comandos.</p>'}catch(e){document.querySelector('#error').textContent=e.message}}
load();setInterval(load,2000);
</script></body></html>'''


if __name__ == "__main__":
    main()
