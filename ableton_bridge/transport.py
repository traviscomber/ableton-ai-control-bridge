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
        message = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.sendto(message, (self.host, self.port))

