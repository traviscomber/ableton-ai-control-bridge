import json
import unittest
from pathlib import Path

from ableton_bridge.commands import validate_command


class SmokeSequenceTest(unittest.TestCase):
    def test_every_smoke_command_is_valid(self):
        path = (
            Path(__file__).resolve().parents[1]
            / "examples"
            / "smoke"
            / "v0.5-smoke-test.jsonl"
        )
        commands = [
            validate_command(json.loads(line))
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.assertGreaterEqual(len(commands), 10)
        self.assertEqual(commands[0]["type"], "set_tempo")
        self.assertEqual(commands[-1]["type"], "stop_all_clips")


if __name__ == "__main__":
    unittest.main()
