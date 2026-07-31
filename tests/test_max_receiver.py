import unittest
from pathlib import Path


def receiver_source() -> str:
    root = Path(__file__).resolve().parents[1]
    candidates = (
        root / "max-for-live" / "bridge_receiver.js",
        root / "Max for Live Device" / "bridge_receiver.js",
    )
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8-sig")
    locations = ", ".join(str(path) for path in candidates)
    raise AssertionError(f"bridge_receiver.js was not found in: {locations}")


class MaxReceiverSourceTest(unittest.TestCase):
    def test_receiver_exposes_dispatch_and_acknowledgement(self):
        source = receiver_source()
        self.assertIn("function dispatch", source)
        self.assertIn("function acknowledge", source)
        self.assertIn("new LiveAPI", source)

    def test_receiver_uses_stable_track_references(self):
        self.assertIn("track_ref", receiver_source())


if __name__ == "__main__":
    unittest.main()
