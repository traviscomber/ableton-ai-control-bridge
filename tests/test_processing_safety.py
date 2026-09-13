from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ProcessingSafetySourceTest(unittest.TestCase):
    def test_apply_is_review_first_and_exact_indexed(self):
        source = (ROOT / "windows" / "titan-processing-apply.ps1").read_text(encoding="utf-8")
        self.assertIn("[switch]$Apply", source)
        self.assertIn("DRY PREFLIGHT ONLY", source)
        self.assertIn("device_index", source)
        self.assertIn("parameter_index", source)
        self.assertIn("MaxNormalizedDelta", source)
        self.assertIn("approve_quantized", source)
        self.assertIn("titan-processing-rollback.json", source)
        self.assertNotIn("Blocked duplicate device name", source)

    def test_rollback_revalidates_topology_and_readback(self):
        source = (ROOT / "windows" / "titan-processing-rollback.ps1").read_text(encoding="utf-8")
        self.assertIn("Device topology drift", source)
        self.assertIn("Parameter topology drift", source)
        self.assertIn("original_normalized", source)
        self.assertIn("readback_normalized", source)
        self.assertIn("Bridge ACK + readback: PASS", source)

    def test_plan_requires_review_metadata(self):
        source = (ROOT / "windows" / "titan-processing-plan.py").read_text(encoding="utf-8")
        self.assertIn('"schema": 2', source)
        self.assertIn('"mode": "review_required"', source)
        self.assertIn('"approve_quantized": False', source)
        self.assertIn('"audible_goal": ""', source)
        self.assertIn('"confidence": None', source)
        self.assertIn('"kick_bass_relationship"', source)


if __name__ == "__main__":
    unittest.main()
