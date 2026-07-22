from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from typing import Any


@dataclass
class UdpTransport:
    host: str = "127.0.0.1"
    port: int = 9001

    def send(self, payload: dict[str, Any]) -> None:
        # Max udpreceive uses Max/FUDI-style messages terminated by a semicolon.
        # Compact JSON contains no unescaped whitespace outside string values and
        # is reconstructed by `tosymbol` before `dict.deserialize`.
        message = (json.dumps(payload, separators=(",", ":")) + ";").encode("utf-8")
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
        text = raw.decode("utf-8").strip().rstrip(";").strip()
        if text.startswith("symbol "):
            text = text[7:]
        payload = json.loads(text)
        return payload if isinstance(payload, dict) else None
