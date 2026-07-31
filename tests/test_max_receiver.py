import unittest
from pathlib import Path


class MaxReceiverSourceTest(unittest.TestCase):
    def test_receiver_exposes_dispatch_and_acknowledgement(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "max-for-live" / "bridge_receiver.js").read_text(encoding="utf-8")
        self.assertIn("function dispatch", source)
        self.assertIn("function acknowledge", source)
        self.assertIn("new LiveAPI", source)

    def test_receiver_uses_stable_track_references(self):
        root = Path(__file__).resolve().parents[1]
        source = (root / "max-for-live" / "bridge_receiver.js").read_text(encoding="utf-8")
        self.assertIn("track_ref", source)


if __name__ == "__main__":
    unittest.main()
