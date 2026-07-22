import os
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from ableton_bridge.runner import iter_jsonl
from ableton_bridge.security import AccessPolicy
from ableton_bridge.server import BridgeState, load_config, make_handler
from ableton_bridge.store import CommandStore


class FakeTransport:
    host = "127.0.0.1"
    port = 9001

    def __init__(self):
        self.messages = []

    def send(self, payload):
        self.messages.append(payload)


class VersionTwoTest(unittest.TestCase):
    def setUp(self):
        handle, self.database = tempfile.mkstemp(suffix=".sqlite3")
        os.close(handle)
        os.unlink(self.database)
        self.transport = FakeTransport()

    def tearDown(self):
        if os.path.exists(self.database):
            os.unlink(self.database)

    def state(self, **kwargs):
        return BridgeState(
            self.transport,
            CommandStore(self.database),
            AccessPolicy(kwargs.pop("token", None), kwargs.pop("allowed", None)),
            **kwargs,
        )

    def test_approval_queue_and_dispatch(self):
        state = self.state(require_approval=True)
        record = state.submit({"type": "set_tempo", "bpm": 128}, "test")
        self.assertEqual(record["status"], "pending")
        self.assertEqual(self.transport.messages, [])
        approved = state.approve(record["id"])
        self.assertEqual(approved["status"], "sent")
        self.assertEqual(self.transport.messages[0]["bridge_id"], record["id"])

    def test_allowlist_rejects_command(self):
        state = self.state(allowed={"set_tempo"})
        with self.assertRaises(PermissionError):
            state.submit({"type": "stop_all_clips"}, "test")

    def test_dry_run_is_persisted(self):
        state = self.state(dry_run=True)
        record = state.submit({"type": "set_tempo", "bpm": 120}, "test")
        self.assertEqual(record["status"], "simulated")
        self.assertEqual(len(state.store.list()), 1)

    def test_token_policy(self):
        policy = AccessPolicy("secret")
        self.assertTrue(policy.authorize("secret"))
        self.assertFalse(policy.authorize("wrong"))

    def test_jsonl_runner(self):
        handle, path = tempfile.mkstemp(suffix=".jsonl", text=True)
        try:
            with os.fdopen(handle, "w") as stream:
                stream.write('# comment\n{"type":"set_tempo","bpm":120}\n\n')
            commands = list(iter_jsonl(path))
            self.assertEqual(commands[0][1]["type"], "set_tempo")
        finally:
            os.unlink(path)

    def test_authenticated_http_approval_flow(self):
        state = self.state(token="secret", require_approval=True, dry_run=True)
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(state))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with self.assertRaises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(base + "/api/commands")
            self.assertEqual(denied.exception.code, 401)
            request = urllib.request.Request(
                base + "/command",
                json.dumps({"type": "set_tempo", "bpm": 126}).encode(),
                {"Content-Type": "application/json", "X-Bridge-Token": "secret"},
                method="POST",
            )
            with urllib.request.urlopen(request) as response:
                created = json.loads(response.read())["command"]
            self.assertEqual(created["status"], "pending")
            approve = urllib.request.Request(
                base + f"/api/commands/{created['id']}/approve",
                b"",
                {"X-Bridge-Token": "secret"},
                method="POST",
            )
            with urllib.request.urlopen(approve) as response:
                approved = json.loads(response.read())["command"]
            self.assertEqual(approved["status"], "simulated")
        finally:
            server.shutdown()
            server.server_close()

    def test_windows_powershell_bom_config(self):
        handle, path = tempfile.mkstemp(suffix=".json")
        try:
            with os.fdopen(handle, "wb") as stream:
                stream.write(b"\xef\xbb\xbf{\"port\":8765,\"require_approval\":true}")
            config = load_config(path)
            self.assertEqual(config["port"], 8765)
            self.assertTrue(config["require_approval"])
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
