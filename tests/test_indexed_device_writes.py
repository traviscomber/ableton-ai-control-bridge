import unittest
from pathlib import Path

from ableton_bridge.commands import CommandError, validate_command


class IndexedDeviceWriteValidationTest(unittest.TestCase):
    def test_accepts_track_indexed_parameter_write(self):
        command = validate_command({
            "type": "set_device_parameter",
            "track": 3,
            "device_index": 5,
            "parameter_index": 17,
            "value": 0.42,
        })
        self.assertEqual(command["device_index"], 5)
        self.assertEqual(command["parameter_index"], 17)

    def test_accepts_return_indexed_parameter_write(self):
        validate_command({
            "type": "set_return_device_parameter",
            "return": 0,
            "device_index": 1,
            "parameter_index": 4,
            "value": 0.25,
        })

    def test_accepts_master_indexed_parameter_write(self):
        validate_command({
            "type": "set_master_device_parameter",
            "device_index": 0,
            "parameter_index": 3,
            "value": 0.75,
        })

    def test_preserves_named_parameter_write(self):
        validate_command({
            "type": "set_device_parameter",
            "track": 0,
            "device": "Operator",
            "parameter": "Filter Freq",
            "value": 0.5,
        })

    def test_rejects_mixed_named_and_indexed_target(self):
        with self.assertRaises(CommandError):
            validate_command({
                "type": "set_device_parameter",
                "track": 0,
                "device": "EQ Eight",
                "parameter": "Gain A",
                "device_index": 4,
                "parameter_index": 12,
                "value": 0.5,
            })

    def test_rejects_partial_index_target(self):
        with self.assertRaises(CommandError):
            validate_command({
                "type": "set_device_parameter",
                "track": 0,
                "device_index": 4,
                "value": 0.5,
            })

    def test_receiver_has_exact_index_path(self):
        source = Path("max-for-live/bridge_receiver.js").read_text(encoding="utf-8")
        self.assertIn("function parameterAtIndex", source)
        self.assertIn("function setParameterIndexedOnPath", source)
        self.assertIn("device_index", source)
        self.assertIn("parameter_index", source)


if __name__ == "__main__":
    unittest.main()
