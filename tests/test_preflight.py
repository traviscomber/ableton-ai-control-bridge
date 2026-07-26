from __future__ import annotations

import json
import unittest
from unittest.mock import patch
import urllib.error

from ableton_bridge.preflight import run_preflight


class _Response:
    def __init__(self, payload: dict[str, object]):
        self._payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")


class PreflightTests(unittest.TestCase):
    def test_offline_bridge_is_warning_when_port_is_available(self) -> None:
        with patch(
            "ableton_bridge.preflight.urllib.request.urlopen",
            side_effect=urllib.error.URLError("offline"),
        ), patch("ableton_bridge.preflight._can_bind") as can_bind:
            from ableton_bridge.preflight import CheckResult

            can_bind.return_value = CheckResult(
                "http_port", True, "pass", "HTTP port is available.", required=False
            )
            report = run_preflight(
                health_url="http://127.0.0.1:8765/health",
                token=None,
                config_path=None,
                host="127.0.0.1",
                port=8765,
                timeout=0.1,
                require_receiver=False,
            )

        self.assertTrue(report["ok"])
        self.assertFalse(report["ready"])
        self.assertEqual(report["summary"]["warnings"], 1)

    def test_running_authenticated_bridge_passes_with_token(self) -> None:
        payload = {
            "ok": True,
            "authentication_required": True,
            "udp_target": "127.0.0.1:9001",
            "ack_listener": "127.0.0.1:9002",
            "max_receiver_seen": True,
            "last_ack_at": "2026-07-26T17:00:00+00:00",
        }
        with patch(
            "ableton_bridge.preflight.urllib.request.urlopen",
            return_value=_Response(payload),
        ):
            report = run_preflight(
                health_url="http://127.0.0.1:8765/health",
                token="secret",
                config_path=None,
                host="127.0.0.1",
                port=8765,
                timeout=0.1,
                require_receiver=True,
            )

        self.assertTrue(report["ok"])
        self.assertTrue(report["ready"])
        self.assertEqual(report["summary"]["failed"], 0)

    def test_receiver_requirement_fails_without_acknowledgement(self) -> None:
        payload = {
            "ok": True,
            "authentication_required": False,
            "udp_target": "127.0.0.1:9001",
            "ack_listener": "127.0.0.1:9002",
            "max_receiver_seen": False,
            "last_ack_at": None,
        }
        with patch(
            "ableton_bridge.preflight.urllib.request.urlopen",
            return_value=_Response(payload),
        ):
            report = run_preflight(
                health_url="http://127.0.0.1:8765/health",
                token=None,
                config_path=None,
                host="127.0.0.1",
                port=8765,
                timeout=0.1,
                require_receiver=True,
            )

        self.assertFalse(report["ok"])
        self.assertEqual(report["summary"]["failed"], 1)


if __name__ == "__main__":
    unittest.main()
