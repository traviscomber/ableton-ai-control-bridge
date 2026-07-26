import hashlib
import json
import wave

import pytest

from darksco_soundbank.generator import BIT_DEPTH, SAMPLE_RATE, generate_library


def test_generate_library_writes_valid_manifest_and_wavs(tmp_path):
    records = generate_library(tmp_path, count=2, seed=1000)

    assert len(records) == 10
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["schema"] == "darksco.soundbank/1.0"
    assert manifest["decision_owner"] == "Irina"
    assert manifest["source_policy"] == "original_synthesis_only"
    assert manifest["asset_count"] == 10

    for record in records:
        path = tmp_path / record.category / f"{record.asset_id}.wav"
        assert path.exists()
        assert hashlib.sha256(path.read_bytes()).hexdigest() == record.sha256
        assert record.bit_depth == BIT_DEPTH
        assert record.sample_rate_hz == SAMPLE_RATE
        assert record.peak_dbfs < 0
        assert record.rights_status == "cleared"
        with wave.open(str(path), "rb") as handle:
            assert handle.getnchannels() == 1
            assert handle.getsampwidth() == 3
            assert handle.getframerate() == SAMPLE_RATE
            assert handle.getnframes() > 0


def test_generation_is_deterministic(tmp_path):
    first = generate_library(tmp_path / "first", count=1, seed=42)
    second = generate_library(tmp_path / "second", count=1, seed=42)

    assert [record.sha256 for record in first] == [record.sha256 for record in second]


def test_seed_changes_assets(tmp_path):
    first = generate_library(tmp_path / "first", count=1, seed=42)
    second = generate_library(tmp_path / "second", count=1, seed=43)

    assert [record.sha256 for record in first] != [record.sha256 for record in second]


def test_rejects_zero_count(tmp_path):
    with pytest.raises(ValueError, match="at least one"):
        generate_library(tmp_path, count=0)
