from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from typing import Any


def _osc_string(value: str) -> bytes:
    raw = value.encode("utf-8") + b"\0"
    return raw + (b"\0" * ((4 - len(raw) % 4) % 4))


def encode_osc(address: str, value: str) -> bytes:
    return _osc_string(address) + _osc_string(",s") + _osc_string(value)


def _read_osc_string(packet: bytes, offset: int) -> tuple[str, int]:
    end = packet.find(b"\0", offset)
    if end < 0:
        raise ValueError("Invalid OSC string")
    value = packet[offset:end].decode("utf-8")
    next_offset = (end + 4) & ~3
    return value, next_offset


def decode_osc(packet: bytes) -> tuple[str, str]:
    address, offset = _read_osc_string(packet, 0)
    tags, offset = _read_osc_string(packet, offset)
    if tags != ",s":
        raise ValueError(f"Expected OSC string argument, got {tags}")
    value, _ = _read_osc_string(packet, offset)
    return address, value


def decode_ack_packet(raw: bytes) -> dict[str, Any] | None:
    """Decode either OSC ACKs or native Max text ACKs.

    Max's ``udpsend`` can emit a normal Max message such as::

        /bridge_ack {"bridge_id":"...","ok":true}

    while the Live Remote Script emits OSC.  Both use the same local ACK port,
    so the bridge must accept both framings without assuming that every packet
    beginning with ``/`` is binary OSC.
    """
    text: str
    try:
        address, text = decode_osc(raw)
        if address != "/bridge_ack":
            return None
    except (UnicodeDecodeError, ValueError):
        try:
            text = raw.decode("utf-8").strip().rstrip(";").strip()
        except UnicodeDecodeError:
            return None
        if text.startswith("/bridge_ack"):
            text = text[len("/bridge_ack"):].strip()
        if text.startswith("symbol "):
            text = text[7:].strip()

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


@dataclass
class UdpTransport:
    host: str = "127.0.0.1"
    port: int = 9001

    def send(self, payload: dict[str, Any]) -> None:
        value = json.dumps(payload, separators=(",", ":"))
        message = encode_osc("/bridge", value)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.sendto(message, (self.host, self.port))


@dataclass
class AckListener:
    host: str = "127.0.0.1"
    port: int = 9002
    timeout: float = 0.5

    def receive(self) -> dict[str, Any] | None:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.host, self.port))
            sock.settimeout(self.timeout)
            try:
                raw, _ = sock.recvfrom(65535)
            except socket.timeout:
                return None
        return decode_ack_packet(raw)
