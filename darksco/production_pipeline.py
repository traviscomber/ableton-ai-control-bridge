"""DARKSCO artist-to-mastering pipeline state and manifest validation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class PipelineError(ValueError):
    """Raised when a production package cannot advance."""


class PipelineStatus(str, Enum):
    BRIEF_APPROVED = "BRIEF_APPROVED"
    ARTIST_WORKING = "ARTIST_WORKING"
    REVISE_ARTIST = "REVISE_ARTIST"
    READY_FOR_MASTERING = "READY_FOR_MASTERING"
    MASTERING = "MASTERING"
    REJECT_TO_ARTIST = "REJECT_TO_ARTIST"
    READY_FOR_IRINA_QC = "READY_FOR_IRINA_QC"
    IRINA_GO = "IRINA_GO"
    IRINA_REVISE = "IRINA_REVISE"
    IRINA_DELAY = "IRINA_DELAY"
    IRINA_REJECT = "IRINA_REJECT"


FINAL_DECISIONS = {
    PipelineStatus.IRINA_GO,
    PipelineStatus.IRINA_REVISE,
    PipelineStatus.IRINA_DELAY,
    PipelineStatus.IRINA_REJECT,
}


@dataclass(frozen=True)
class PipelineDecision:
    status: PipelineStatus
    owner: str
    reason: str


def validate_artist_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    if manifest.get("schema") != "darksco.artist-package/1.0":
        raise PipelineError("invalid artist package schema")
    project = manifest.get("project", {})
    if project.get("decision_owner") != "Irina":
        raise PipelineError("Irina must be the decision owner")
    audio = manifest.get("audio", {})
    if audio.get("premaster_peak_dbfs", 0) > -3:
        raise PipelineError("premaster requires at least 3 dB peak headroom")
    stems = manifest.get("stems", [])
    if not stems:
        raise PipelineError("artist package requires at least one stem")
    if any(stem.get("silent") for stem in stems):
        raise PipelineError("silent placeholder stems are not allowed")
    if any(not stem.get("sha256") for stem in stems):
        raise PipelineError("every stem requires a SHA-256 checksum")
    rights = manifest.get("rights", {})
    if rights.get("status") != "cleared":
        raise PipelineError("rights must be cleared before mastering")
    approval = manifest.get("approval", {})
    if approval.get("artist_status") != PipelineStatus.READY_FOR_MASTERING.value:
        raise PipelineError("artist package is not ready for mastering")
    if approval.get("irina_production_approval") is not True:
        raise PipelineError("Irina production approval is required")
    return manifest


def validate_mastering_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    if manifest.get("schema") != "darksco.master-package/1.0":
        raise PipelineError("invalid mastering package schema")
    project = manifest.get("project", {})
    if project.get("decision_owner") != "Irina":
        raise PipelineError("Irina must be the decision owner")
    source = manifest.get("input", {})
    if source.get("reconstruction_check") != "pass":
        raise PipelineError("stem reconstruction check must pass")
    masters = manifest.get("masters", [])
    if not masters:
        raise PipelineError("mastering package requires at least one master")
    if any(not item.get("sha256") for item in masters):
        raise PipelineError("every master requires a SHA-256 checksum")
    qc = manifest.get("qc", {})
    required_qc = {"mono", "headphones", "small_speaker", "truncation", "metadata"}
    failed = sorted(key for key in required_qc if qc.get(key) != "pass")
    if failed:
        raise PipelineError("mastering QC failed: " + ", ".join(failed))
    approval = manifest.get("approval", {})
    if approval.get("mastering_status") != PipelineStatus.READY_FOR_IRINA_QC.value:
        raise PipelineError("master is not ready for Irina QC")
    return manifest


def irina_decision(value: str, reason: str) -> PipelineDecision:
    mapping = {
        "GO": PipelineStatus.IRINA_GO,
        "REVISE": PipelineStatus.IRINA_REVISE,
        "DELAY": PipelineStatus.IRINA_DELAY,
        "REJECT": PipelineStatus.IRINA_REJECT,
    }
    try:
        status = mapping[value.upper()]
    except KeyError as exc:
        raise PipelineError("Irina decision must be GO, REVISE, DELAY, or REJECT") from exc
    if not reason.strip():
        raise PipelineError("Irina decision requires a reason")
    return PipelineDecision(status=status, owner="Irina", reason=reason.strip())
