from __future__ import annotations

import argparse
import json
import os
import platform
import socket
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    status: str
    detail: str
    required: bool = True


def _check_python() -> CheckResult:
    version = sys.version_info
    ok = version >= (3, 10)
    return CheckResult(
        name="python",
        ok=ok,
        status="pass" if ok else "fail",
        detail=f"Python {platform.python_version()} detected; Python 3.10+ is required.",
    )


def _check_config(path: str | None) -> tuple[CheckResult, dict[str, Any]]:
    if not path:
        return (
            CheckResult(
                name="config",
                ok=True,
                status="skip",
                detail="No config file supplied; command-line defaults and environment variables will be used.",
                required=False,
            ),
            {},
        )

    config_path = Path(path)
    if not config_path.is_file():
        return (
            CheckResult("config", False, "fail", f"Config file not found: {config_path}"),
            {},
        )

    try:
        payload = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        return (
            CheckResult("config", False, "fail", f"Config file is not valid JSON: {exc}"),
            {},
        )

    if not isinstance(payload, dict):
        return (
            CheckResult("config", False, "fail", "Config file must contain a JSON object."),
            {},
        )

    return (
        CheckResult("config", True, "pass", f"Loaded configuration from {config_path}."),
        payload,
    )


def _can_bind(host: str, port: int) -> CheckResult:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
    except OSError as exc:
        return CheckResult(
            name="http_port",
            ok=False,
            status="warn",
            detail=f"Cannot bind {host}:{port}: {exc}. The bridge may already be running.",
            required=False,
        )
    finally:
        sock.close()
    return CheckResult(
        name="http_port",
        ok=True,
        status="pass",
        detail=f"HTTP port {host}:{port} is available.",
        required=False,
    )


def _load_health(url: str, token: str | None, timeout: float) -> tuple[CheckResult, dict[str, Any]]:
    headers: dict[str, str] = {}
    if token:
        headers["X-Bridge-Token"] = token
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return (
            CheckResult("bridge_health", False, "fail", f"Bridge returned HTTP {exc.code}: {exc.reason}"),
            {},
        )
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return (
            CheckResult(
                "bridge_health",
                False,
                "offline",
                f"Bridge is not reachable at {url}: {exc}",
                required=False,
            ),
            {},
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        return (
            CheckResult("bridge_health", False, "fail", f"Bridge health response is invalid JSON: {exc}"),
            {},
        )

    if not isinstance(payload, dict) or payload.get("ok") is not True:
        return (
            CheckResult("bridge_health", False, "fail", "Bridge health response did not report ok=true."),
            {},
        )
    return (
        CheckResult("bridge_health", True, "pass", f"Bridge is reachable at {url}."),
        payload,
    )


def run_preflight(
    *,
    health_url: str,
    token: str | None,
    config_path: str | None,
    host: str,
    port: int,
    timeout: float,
    require_receiver: bool,
) -> dict[str, Any]:
    checks: list[CheckResult] = [_check_python()]
    config_check, config = _check_config(config_path)
    checks.append(config_check)

    effective_token = token or config.get("token") or os.environ.get("ABLETON_BRIDGE_TOKEN")
    effective_host = str(config.get("host", host))
    effective_port = int(config.get("port", port))

    health_check, health = _load_health(health_url, effective_token, timeout)
    checks.append(health_check)

    if health_check.status == "offline":
        checks.append(_can_bind(effective_host, effective_port))
    elif health:
        auth_required = bool(health.get("authentication_required"))
        checks.append(
            CheckResult(
                name="authentication",
                ok=not auth_required or bool(effective_token),
                status="pass" if (not auth_required or effective_token) else "fail",
                detail=(
                    "Authentication is configured and a token is available."
                    if auth_required and effective_token
                    else "Bridge authentication is disabled."
                    if not auth_required
                    else "Bridge requires authentication but no token was supplied."
                ),
            )
        )

        receiver_seen = bool(health.get("max_receiver_seen"))
        checks.append(
            CheckResult(
                name="max_receiver",
                ok=receiver_seen or not require_receiver,
                status="pass" if receiver_seen else "warn" if not require_receiver else "fail",
                detail=(
                    f"Max receiver acknowledged the bridge at {health.get('last_ack_at')}."
                    if receiver_seen
                    else "No Max receiver acknowledgement has been observed. Load the receiver in Ableton and run a smoke command."
                ),
                required=require_receiver,
            )
        )

        checks.append(
            CheckResult(
                name="transport",
                ok=bool(health.get("udp_target")) and bool(health.get("ack_listener")),
                status="pass" if health.get("udp_target") and health.get("ack_listener") else "fail",
                detail=f"UDP target={health.get('udp_target')} ACK listener={health.get('ack_listener')}",
            )
        )

    failed_required = [check for check in checks if check.required and not check.ok]
    warnings = [check for check in checks if check.status in {"warn", "offline"}]
    return {
        "ok": not failed_required,
        "ready": not failed_required and not warnings,
        "checks": [asdict(check) for check in checks],
        "summary": {
            "passed": sum(1 for check in checks if check.status == "pass"),
            "warnings": len(warnings),
            "failed": len(failed_required),
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Ableton AI Control Bridge preflight diagnostics.")
    parser.add_argument("--health-url", default="http://127.0.0.1:8765/health")
    parser.add_argument("--token", default=os.environ.get("ABLETON_BRIDGE_TOKEN"))
    parser.add_argument("--config", dest="config_path")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument("--timeout", default=2.0, type=float)
    parser.add_argument("--require-receiver", action="store_true")
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    report = run_preflight(
        health_url=args.health_url,
        token=args.token,
        config_path=args.config_path,
        host=args.host,
        port=args.port,
        timeout=args.timeout,
        require_receiver=args.require_receiver,
    )
    if args.json_output:
        print(json.dumps(report, indent=2))
    else:
        for check in report["checks"]:
            marker = "PASS" if check["status"] == "pass" else check["status"].upper()
            print(f"[{marker}] {check['name']}: {check['detail']}")
        summary = report["summary"]
        print(
            f"Preflight: passed={summary['passed']} warnings={summary['warnings']} failed={summary['failed']}"
        )
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
