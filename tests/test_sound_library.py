import json
import tempfile
import unittest
from pathlib import Path

from darksco.catalog_scraper import save_candidates
from darksco.sound_library import classify, import_sounds, infer_music_metadata


class SoundLibraryTest(unittest.TestCase):
    def test_classifies_and_reads_filename_metadata(self):
        self.assertEqual(classify("DD_Funk_Guitar_124bpm_Am.wav"), "funk_guitar")
        self.assertEqual(infer_music_metadata("DD_Funk_Guitar_124bpm_Am"), {"bpm": 124, "key": "Am"})

    def test_imports_and_deduplicates_audio(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "inbox"
            library = root / "library"
            source.mkdir()
            (source / "Techno_Kick_128bpm_C.wav").write_bytes(b"RIFF-test")
            result = import_sounds(
                source,
                library,
                provider="Test",
                license_name="CC0",
            )
            self.assertEqual(result["imported"], 1)
            self.assertEqual(
                import_sounds(source, library, provider="Test", license_name="CC0")["duplicates"],
                1,
            )
            catalog = json.loads((library / "catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["sounds"][0]["category"], "kicks")
            self.assertEqual(catalog["sounds"][0]["bpm"], 128)

    def test_candidate_merge_is_stable(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "candidates.json"
            item = {"id": "openverse:1", "source": "openverse", "title": "Kick"}
            save_candidates(output, "openverse", "kick", [item])
            save_candidates(output, "openverse", "kick", [item])
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(len(payload["candidates"]), 1)


if __name__ == "__main__":
    unittest.main()
