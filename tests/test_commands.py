import unittest

from ableton_bridge.commands import CommandError, validate_command


class CommandValidationTest(unittest.TestCase):
    def test_set_tempo(self):
        command = validate_command({"type": "set_tempo", "bpm": 132})
        self.assertEqual(command["bpm"], 132)

    def test_rejects_unknown_type(self):
        with self.assertRaises(CommandError):
            validate_command({"type": "explode", "value": 1})

    def test_rejects_bad_macro_range(self):
        with self.assertRaises(CommandError):
            validate_command({"type": "set_macro", "track": 1, "macro": 20, "value": 0.5})

    def test_accepts_midi_clip(self):
        command = validate_command(
            {
                "type": "create_midi_clip",
                "track": 1,
                "clip": 0,
                "bar": 1,
                "beats": 8,
                "notes": [{"pitch": 41, "start": 0, "duration": 0.5, "velocity": 100}],
            }
        )
        self.assertEqual(command["notes"][0]["pitch"], 41)

    def test_rejects_bad_track_name(self):
        with self.assertRaises(CommandError):
            validate_command({"type": "create_midi_track", "name": ""})

    def test_rejects_bad_device_value(self):
        with self.assertRaises(CommandError):
            validate_command({
                "type": "set_device_parameter", "track": 0,
                "device": "Synth", "parameter": "Cutoff", "value": 2,
            })

    def test_arm_requires_boolean(self):
        with self.assertRaises(CommandError):
            validate_command({"type": "arm_track", "track": 0, "armed": 1})

    def test_accepts_song_structure_commands(self):
        validate_command({"type": "set_time_signature", "numerator": 4, "denominator": 4})
        validate_command({"type": "create_scene", "name": "DROP", "index": 2})
        validate_command({"type": "set_song_loop", "start": 0, "length": 32, "enabled": True})

    def test_accepts_clip_commands(self):
        validate_command({"type": "launch_clip", "track": 0, "clip": 1})
        validate_command({"type": "set_clip_color", "track": 0, "clip": 1, "color": 0xFF5500})
        validate_command({"type": "set_clip_loop", "track": 0, "clip": 1, "start": 0, "length": 8, "enabled": True})

    def test_rejects_bad_time_signature(self):
        with self.assertRaises(CommandError):
            validate_command({"type": "set_time_signature", "numerator": 4, "denominator": 3})


if __name__ == "__main__":
    unittest.main()
