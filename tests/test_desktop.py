import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ableton_bridge.commands import COMMANDS
from ableton_bridge.desktop import ensure_config


class DesktopConfigurationTest(unittest.TestCase):
    def test_creates_complete_local_configuration(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.dict(os.environ, {"LOCALAPPDATA": temporary}):
                path = ensure_config()
                config = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(config["host"], "127.0.0.1")
                self.assertEqual(config["remote_script_port"], 9003)
                self.assertFalse(config["require_approval"])
                self.assertEqual(set(config["allow"]), set(COMMANDS))
                self.assertTrue(str(Path(temporary)) in config["database"])

    def test_keeps_existing_token(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.dict(os.environ, {"LOCALAPPDATA": temporary}):
                path = ensure_config()
                original = json.loads(path.read_text(encoding="utf-8"))["token"]
                self.assertEqual(ensure_config(), path)
                self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["token"], original)


if __name__ == "__main__":
    unittest.main()
