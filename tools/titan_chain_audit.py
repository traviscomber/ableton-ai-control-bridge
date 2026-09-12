from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from dataclasses import dataclass, asdict
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TERMINAL = {"acknowledged", "error", "rejected", "simulated"}


@dataclass
class Finding:
    severity: str
    target: str
    device: str | None
    parameter: str | None
    message: str


class BridgeClient:
    def __init__(self, base_url: str, token: str | None, timeout: float = 5.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Bridge-Token"] = self.token
        request = Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Bridge HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"Cannot reach bridge at {self.base_url}: {exc}") from exc

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def command(self, payload: dict[str, Any], poll_timeout: float = 8.0) -> dict[str, Any]:
        submitted = self._request("POST", "/command", payload)
        record = submitted.get("command") or {}
        command_id = record.get("id")
        if not command_id:
            raise RuntimeError(f"Bridge did not return a command id for {payload.get('type')}")
        deadline = time.time() + poll_timeout
        while time.time() < deadline:
            state = self._request("GET", f"/api/commands/{command_id}").get("command") or {}
            if state.get("status") in TERMINAL:
                if state.get("status") != "acknowledged":
                    raise RuntimeError(
                        f"{payload.get('type')} failed with status={state.get('status')}: "
                        f"{state.get('error') or state.get('result')}"
                    )
                return state.get("result") or {}
            time.sleep(0.08)
        raise RuntimeError(f"Timed out waiting for ACK for {payload.get('type')}")


def expected_normalized(minimum: float, maximum: float, value: float) -> float:
    if maximum == minimum:
        return 0.0
    return max(0.0, min(1.0, (value - minimum) / (maximum - minimum)))


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(float(value))


def audit_parameter(target: str, device: str, parameter: dict[str, Any], findings: list[Finding]) -> None:
    name = str(parameter.get("name", "<unnamed>"))
    minimum = parameter.get("min")
    maximum = parameter.get("max")
    value = parameter.get("value")
    normalized = parameter.get("normalized")

    if not all(finite(v) for v in (minimum, maximum, value, normalized)):
        findings.append(Finding("FAIL", target, device, name, "Non-finite min/max/value/normalized metadata"))
        return

    minimum = float(minimum)
    maximum = float(maximum)
    value = float(value)
    normalized = float(normalized)

    if maximum < minimum:
        findings.append(Finding("FAIL", target, device, name, f"Invalid range: min={minimum} max={maximum}"))
        return
    if value < minimum - 1e-9 or value > maximum + 1e-9:
        findings.append(Finding("FAIL", target, device, name, f"Value {value} outside [{minimum}, {maximum}]"))

    expected = expected_normalized(minimum, maximum, value)
    if abs(normalized - expected) > 1e-6:
        findings.append(
            Finding(
                "FAIL",
                target,
                device,
                name,
                f"Normalized mismatch: reported={normalized:.9f} expected={expected:.9f}",
            )
        )

    if parameter.get("duplicate_name"):
        findings.append(Finding("FAIL", target, device, name, "Duplicate parameter name; writes are intentionally blocked"))

    if parameter.get("is_quantized"):
        items = parameter.get("value_items") or []
        if items and len(items) > 1:
            steps = len(items) - 1
            if maximum != minimum:
                position = (value - minimum) / (maximum - minimum) * steps
                if abs(position - round(position)) > 1e-5:
                    findings.append(
                        Finding("FAIL", target, device, name, f"Quantized value {value} is not aligned to {steps + 1} valid items")
                    )


def audit_target(
    client: BridgeClient,
    target_kind: str,
    findings: list[Finding],
    stats: dict[str, int],
    *,
    track: int | None = None,
    return_index: int | None = None,
) -> None:
    target_label = target_kind
    chain_cmd: dict[str, Any] = {"type": "inspect_device_chain", "target_kind": target_kind}
    if target_kind == "track":
        chain_cmd["track"] = track
        target_label = f"track:{track}"
    elif target_kind == "return":
        chain_cmd["return"] = return_index
        target_label = f"return:{return_index}"

    chain = client.command(chain_cmd)
    devices = chain.get("devices") or []
    stats["devices"] += len(devices)

    for device in devices:
        device_name = str(device.get("name", "<unnamed>"))
        if device.get("duplicate_name"):
            findings.append(Finding("FAIL", target_label, device_name, None, "Duplicate device name; parameter binding is ambiguous"))
            stats["skipped_devices"] += 1
            continue

        param_cmd: dict[str, Any] = {
            "type": "inspect_device_parameters",
            "target_kind": target_kind,
            "device": device_name,
        }
        if target_kind == "track":
            param_cmd["track"] = track
        elif target_kind == "return":
            param_cmd["return"] = return_index

        result = client.command(param_cmd)
        parameters = result.get("parameters") or []
        stats["parameters"] += len(parameters)
        for parameter in parameters:
            audit_parameter(target_label, device_name, parameter, findings)


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only TITAN audit for the entire Ableton device chain.")
    parser.add_argument("--bridge", default=os.environ.get("ABLETON_BRIDGE_URL", "http://127.0.0.1:8765"))
    parser.add_argument("--token", default=os.environ.get("ABLETON_BRIDGE_TOKEN"))
    parser.add_argument("--json", dest="json_path", help="Optional report output path")
    args = parser.parse_args()

    client = BridgeClient(args.bridge, args.token)
    findings: list[Finding] = []
    stats = {"tracks": 0, "returns": 0, "devices": 0, "parameters": 0, "skipped_devices": 0}

    health = client.health()
    if not health.get("ok"):
        raise RuntimeError(f"Bridge health failed: {health}")
    if not health.get("max_receiver_seen"):
        findings.append(Finding("FAIL", "bridge", None, None, "Max receiver has not ACKed this bridge session"))

    tracks = (client.command({"type": "list_tracks"}).get("tracks") or [])
    returns = (client.command({"type": "list_returns"}).get("returns") or [])
    stats["tracks"] = len(tracks)
    stats["returns"] = len(returns)

    for item in tracks:
        audit_target(client, "track", findings, stats, track=int(item["index"]))
    for item in returns:
        audit_target(client, "return", findings, stats, return_index=int(item["index"]))
    audit_target(client, "master", findings, stats)

    failures = [finding for finding in findings if finding.severity == "FAIL"]
    report = {
        "ok": not failures,
        "read_only": True,
        "bridge": args.bridge,
        "stats": stats,
        "findings": [asdict(finding) for finding in findings],
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, ensure_ascii=False)
            handle.write("\n")

    return 0 if report["ok"] else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as exc:
        print(f"TITAN chain audit failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
