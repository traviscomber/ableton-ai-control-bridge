from __future__ import annotations

import hmac


class AccessPolicy:
    def __init__(self, token: str | None = None, allowed: set[str] | None = None):
        self.token = token
        self.allowed = allowed

    def authorize(self, supplied: str | None) -> bool:
        if not self.token:
            return True
        return bool(supplied) and hmac.compare_digest(supplied, self.token)

    def allows(self, command_type: str) -> bool:
        return self.allowed is None or command_type in self.allowed
