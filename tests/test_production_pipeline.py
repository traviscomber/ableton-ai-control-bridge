from __future__ import annotations

import pytest

from darksco.production_pipeline import (
    PipelineError,
    PipelineStatus,
    irina_decision,
    validate_artist_manifest,
    validate_mastering_manifest,
)


def artist_manifest() -> dict:
    return {
        "schema": "darksco.artist-package/1.0",
        "project": {"id": "night-protocol-001", "decision_owner": "Irina"},
        "audio": {"premaster_peak_dbfs": -6.0},
        "stems": [{"role": "01_kick", "sha256": "abc", "silent": False}],
        "rights": {"status": "cleared"},
        "approval": {
            "artist_status": PipelineStatus.READY_FOR_MASTERING.value,
            "irina_production_approval": True,
        },
    }


def mastering_manifest() -> dict:
    return {
        "schema": "darksco.master-package/1.0",
        "project": {"id": "night-protocol-001", "decision_owner": "Irina"},
        "input": {"reconstruction_check": "pass"},
        "masters": [{"role": "archive_master", "sha256": "def"}],
        "qc": {
            "mono": "pass",
            "headphones": "pass",
            "small_speaker": "pass",
            "truncation": "pass",
            "metadata": "pass",
        },
        "approval": {"mastering_status": PipelineStatus.READY_FOR_IRINA_QC.value},
    }


def test_artist_manifest_passes() -> None:
    assert validate_artist_manifest(artist_manifest())["project"]["id"] == "night-protocol-001"


def test_artist_manifest_rejects_unknown_rights() -> None:
    manifest = artist_manifest()
    manifest["rights"]["status"] = "unknown"
    with pytest.raises(PipelineError, match="rights must be cleared"):
        validate_artist_manifest(manifest)


def test_artist_manifest_requires_irina_approval() -> None:
    manifest = artist_manifest()
    manifest["approval"]["irina_production_approval"] = False
    with pytest.raises(PipelineError, match="Irina production approval"):
        validate_artist_manifest(manifest)


def test_mastering_manifest_passes() -> None:
    assert validate_mastering_manifest(mastering_manifest())["approval"]["mastering_status"] == "READY_FOR_IRINA_QC"


def test_mastering_manifest_rejects_failed_qc() -> None:
    manifest = mastering_manifest()
    manifest["qc"]["mono"] = "fail"
    with pytest.raises(PipelineError, match="mastering QC failed: mono"):
        validate_mastering_manifest(manifest)


def test_irina_is_only_final_decision_owner() -> None:
    decision = irina_decision("GO", "Approved after final listening and QC.")
    assert decision.owner == "Irina"
    assert decision.status is PipelineStatus.IRINA_GO


def test_irina_decision_requires_reason() -> None:
    with pytest.raises(PipelineError, match="requires a reason"):
        irina_decision("REVISE", "")
