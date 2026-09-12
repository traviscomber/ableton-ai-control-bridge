from tools.titan_chain_audit import Finding, audit_parameter, expected_normalized


def test_expected_normalized_respects_live_range() -> None:
    assert expected_normalized(-1.0, 1.0, 0.0) == 0.5
    assert expected_normalized(20.0, 20000.0, 20.0) == 0.0
    assert expected_normalized(20.0, 20000.0, 20000.0) == 1.0
    assert expected_normalized(3.0, 3.0, 3.0) == 0.0


def test_audit_parameter_accepts_consistent_continuous_metadata() -> None:
    findings: list[Finding] = []
    audit_parameter(
        "track:0",
        "EQ Eight",
        {
            "name": "Gain 1",
            "min": -15.0,
            "max": 15.0,
            "value": 0.0,
            "normalized": 0.5,
            "is_quantized": False,
            "is_enabled": True,
            "value_items": [],
            "duplicate_name": False,
        },
        findings,
    )
    assert findings == []


def test_audit_parameter_rejects_bad_normalized_math() -> None:
    findings: list[Finding] = []
    audit_parameter(
        "track:0",
        "Auto Filter",
        {
            "name": "Frequency",
            "min": 20.0,
            "max": 20000.0,
            "value": 10010.0,
            "normalized": 0.25,
            "is_quantized": False,
            "duplicate_name": False,
        },
        findings,
    )
    assert any("Normalized mismatch" in finding.message for finding in findings)


def test_audit_parameter_checks_quantized_alignment() -> None:
    findings: list[Finding] = []
    audit_parameter(
        "track:0",
        "Utility",
        {
            "name": "Mode",
            "min": 0.0,
            "max": 2.0,
            "value": 0.5,
            "normalized": 0.25,
            "is_quantized": True,
            "value_items": ["A", "B", "C"],
            "duplicate_name": False,
        },
        findings,
    )
    assert any("Quantized value" in finding.message for finding in findings)


def test_audit_parameter_flags_duplicate_parameter_names() -> None:
    findings: list[Finding] = []
    audit_parameter(
        "master",
        "Limiter",
        {
            "name": "Gain",
            "min": 0.0,
            "max": 1.0,
            "value": 0.5,
            "normalized": 0.5,
            "is_quantized": False,
            "duplicate_name": True,
        },
        findings,
    )
    assert any("Duplicate parameter name" in finding.message for finding in findings)
