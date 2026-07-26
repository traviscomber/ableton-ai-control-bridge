from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = (ROOT / "windows" / "install.ps1").read_text(encoding="utf-8")
DOCTOR = (ROOT / "windows" / "doctor.ps1").read_text(encoding="utf-8")


def test_repair_manifest_includes_current_diagnostics_and_smoke_assets() -> None:
    required = {
        "ableton_bridge/preflight.py",
        "examples/smoke/v0.5-smoke-test.jsonl",
        "tests/test_command_coverage.py",
        "tests/test_max_receiver.py",
        "tests/test_preflight.py",
        "tests/test_smoke_sequence.py",
        "tests/test_windows_configuration.py",
        "docs/command-coverage.md",
        "docs/preflight.md",
        "docs/sprint-001-status.md",
    }
    missing = sorted(path for path in required if f'"{path}"' not in INSTALLER)
    assert not missing, f"Windows repair manifest is missing: {missing}"


def test_repair_preserves_compiled_device_and_local_state() -> None:
    assert "The user's compiled .amxd is intentionally left untouched." in INSTALLER
    assert "Keeping your token, approval setting, and history" in INSTALLER
    assert 'Remove-Item $DeviceDir' not in INSTALLER
    assert 'Remove-Item $ConfigPath' not in INSTALLER
    assert 'Remove-Item $DataDir' not in INSTALLER


def test_doctor_uses_configured_port_and_preflight() -> None:
    assert "Get-NetTCPConnection -LocalPort $httpPort" in DOCTOR
    assert '"--health-url", $healthUrl' in DOCTOR
    assert '"-m", "ableton_bridge.preflight"' in DOCTOR
    assert 'if ($bridgeRunning) { $preflightArgs += "--require-receiver" }' in DOCTOR


def test_doctor_validates_local_only_configuration() -> None:
    assert 'Check "Local HTTP binding"' in DOCTOR
    assert 'Check "Local UDP target"' in DOCTOR
    assert 'Check "Local ACK listener"' in DOCTOR
    assert 'Check "Authentication token"' in DOCTOR
    assert 'Check "Command allowlist"' in DOCTOR
