from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

USER_AGENT = "AbletonAIControlBridge/0.5 (+https://github.com/traviscomber/ableton-ai-control-bridge)"
SAFE_LICENSES = {"cc0", "by", "by-sa", "pdm"}


def request_json(url: str, *, token: str = "") -> dict[str, Any]:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Token {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        if int(response.headers.get("Content-Length", "0") or 0) > 8_000_000:
            raise ValueError("Catalog response is too large")
        return json.loads(response.read(8_000_001).decode("utf-8"))


def openverse(query: str, limit: int) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode(
        {"q": query, "page_size": min(limit, 50), "license": ",".join(sorted(SAFE_LICENSES))}
    )
    payload = request_json(f"https://api.openverse.org/v1/audio/?{params}")
    results = []
    for item in payload.get("results", [])[:limit]:
        results.append(
            {
                "id": f"openverse:{item.get('id')}",
                "source": "openverse",
                "title": item.get("title") or "",
                "creator": item.get("creator") or "",
                "provider": item.get("provider") or item.get("source") or "",
                "foreign_url": item.get("foreign_landing_url") or "",
                "audio_url": item.get("url") or "",
                "preview_url": item.get("audio_set") or item.get("thumbnail") or "",
                "license": item.get("license") or "",
                "license_version": item.get("license_version") or "",
                "license_url": item.get("license_url") or "",
                "duration_ms": item.get("duration"),
                "tags": [tag.get("name", "") for tag in item.get("tags", []) if isinstance(tag, dict)],
                "license_verified": False,
                "status": "candidate",
            }
        )
    return results


def freesound(query: str, limit: int, token: str) -> list[dict[str, Any]]:
    if not token:
        raise ValueError("Freesound requires --token or FREESOUND_API_KEY")
    params = urllib.parse.urlencode(
        {
            "query": query,
            "page_size": min(limit, 150),
            "filter": 'license:("Creative Commons 0" OR "Attribution")',
            "fields": "id,name,username,url,license,tags,duration,samplerate,previews",
        }
    )
    payload = request_json(f"https://freesound.org/apiv2/search/text/?{params}", token=token)
    results = []
    for item in payload.get("results", [])[:limit]:
        previews = item.get("previews") or {}
        results.append(
            {
                "id": f"freesound:{item.get('id')}",
                "source": "freesound",
                "title": item.get("name") or "",
                "creator": item.get("username") or "",
                "foreign_url": item.get("url") or "",
                "preview_url": previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3") or "",
                "license": item.get("license") or "",
                "license_url": item.get("license") or "",
                "duration_seconds": item.get("duration"),
                "sample_rate": item.get("samplerate"),
                "tags": item.get("tags") or [],
                "license_verified": False,
                "status": "candidate",
            }
        )
    return results


def save_candidates(path: Path, source: str, query: str, items: list[dict[str, Any]]) -> None:
    existing: dict[str, Any] = {"schema": "darksco.sound-candidates/1.0", "candidates": []}
    if path.exists():
        with path.open("r", encoding="utf-8-sig") as handle:
            existing = json.load(handle)
    indexed = {item["id"]: item for item in existing.get("candidates", [])}
    for item in items:
        indexed[item["id"]] = item
    existing.update(
        {
            "schema": "darksco.sound-candidates/1.0",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_search": {"source": source, "query": query},
            "candidates": sorted(indexed.values(), key=lambda item: (item["source"], item["title"].lower())),
        }
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(existing, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover openly licensed sound metadata without downloading audio."
    )
    parser.add_argument("query")
    parser.add_argument("--source", choices=("openverse", "freesound"), default="openverse")
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--output", default="Sound Library/candidates.json")
    parser.add_argument("--token", default=os.environ.get("FREESOUND_API_KEY", ""))
    args = parser.parse_args()
    if not 1 <= args.limit <= 150:
        parser.error("--limit must be between 1 and 150")
    items = (
        openverse(args.query, args.limit)
        if args.source == "openverse"
        else freesound(args.query, args.limit, args.token)
    )
    save_candidates(Path(args.output), args.source, args.query, items)
    print(json.dumps({"source": args.source, "found": len(items), "output": args.output}))


if __name__ == "__main__":
    main()
