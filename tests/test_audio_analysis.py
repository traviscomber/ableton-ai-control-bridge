from __future__ import annotations

import math
import struct
import tempfile
import unittest
import wave
from pathlib import Path

from ableton_bridge.audio_analysis import analyze_wav, compare_analyses


class AudioAnalysisTest(unittest.TestCase):
    def _write_wav(self, path: Path, *, amplitude: float = 0.5, frequency: float = 100.0, stereo_phase: float = 0.0) -> None:
        sample_rate = 8000
        frames = sample_rate
        payload = bytearray()
        for i in range(frames):
            t = i / sample_rate
            left = amplitude * math.sin(2 * math.pi * frequency * t)
            right = amplitude * math.sin(2 * math.pi * frequency * t + stereo_phase)
            payload.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(sample_rate)
            handle.writeframes(bytes(payload))

    def test_analyze_wav_reports_level_and_stereo_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "tone.wav"
            self._write_wav(path, amplitude=0.5, frequency=100.0)
            result = analyze_wav(path)

        self.assertEqual(result["format"]["channels"], 2)
        self.assertAlmostEqual(result["level"]["peak_dbfs"], -6.02, delta=0.2)
        self.assertAlmostEqual(result["level"]["rms_dbfs"], -9.03, delta=0.3)
        self.assertGreater(result["stereo"]["correlation"], 0.99)
        self.assertGreater(result["spectral_balance"]["low_end_ratio"], 0.5)
        self.assertEqual(result["limits"]["lufs"], "not_measured")

    def test_compare_flags_clipping_and_negative_correlation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            before_path = Path(temp) / "before.wav"
            after_path = Path(temp) / "after.wav"
            self._write_wav(before_path, amplitude=0.4, frequency=220.0)
            self._write_wav(after_path, amplitude=1.0, frequency=80.0, stereo_phase=math.pi)
            before = analyze_wav(before_path)
            after = analyze_wav(after_path)
            result = compare_analyses(before, after)

        self.assertEqual(result["decision"], "review_required")
        self.assertIn("negative_stereo_correlation", result["warnings"])
        self.assertGreater(result["delta"]["peak_db"], 5.0)


if __name__ == "__main__":
    unittest.main()
