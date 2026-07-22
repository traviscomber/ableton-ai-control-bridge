import unittest

from darksco import SongPlanError, compile_song_plan


class DarkscoTest(unittest.TestCase):
    def plan(self):
        return {
            "schema": "darksco.song-plan/1.0", "session": {"mode": "producer"},
            "global": {"bpm": 124, "time_signature": [4, 4]},
            "sections": [{"id": "intro", "name": "INTRO"}],
            "tracks": [{"id": "bass", "kind": "midi", "register": [36, 55],
                        "clips": [{"section": "intro", "length_beats": 4,
                                   "notes": [{"pitch": 38, "start": 0, "duration": 1, "velocity": 100}]}]}],
        }

    def test_compiles_deterministically(self):
        commands = compile_song_plan(self.plan())
        self.assertEqual(commands[0], {"type": "set_tempo", "bpm": 124})
        self.assertEqual(commands[2]["type"], "create_scene")
        self.assertEqual(commands[4]["type"], "create_midi_clip")

    def test_rejects_note_outside_register(self):
        plan = self.plan()
        plan["tracks"][0]["clips"][0]["notes"][0]["pitch"] = 80
        with self.assertRaises(SongPlanError):
            compile_song_plan(plan)


if __name__ == "__main__":
    unittest.main()
