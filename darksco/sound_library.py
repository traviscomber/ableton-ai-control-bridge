from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff", ".flac"}
CATEGORY_RULES = (
    ("kicks", ("kick", "bd_", "bassdrum")),
    ("snares_claps", ("snare", "clap", "rim")),
    ("hats", ("hihat", "hi_hat", "hat_", "hh_", "cymbal")),
    ("percussion", ("perc", "conga", "bongo", "shaker", "tamb", "tom")),
    ("bass", ("bass", "sub", "moog")),
    ("funk_guitar", ("guitar", "gtr", "wah", "chank")),
    ("synth_stabs", ("stab", "chord", "synth", "keys", "organ")),
    ("fx_atmospheres", ("fx", "riser", "impact", "noise", "atmo", "texture")),
    ("vocals", ("vocal", "vox", "voice")),
)
KEY_RE = re.compile(r"(?<![A-Za-z])([A-Ga-g])([#b]?)(m|min|maj)?(?![A-Za-z])")
BPM_RE = re.compile(r"(?<!\d)([6-9]\d|1\d\d|2[0-4]\d)\s*(?:bpm)?(?!\d)", re.I)


def default_library_root() -> Path:
    return Path.cwd() / "Sound Library"


def classify(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.lower())
    for category, words in CATEGORY_RULES:
        if any(word in normalized for word in words):
            return category
    return "other"


def infer_music_metadata(name: str) -> dict[str, Any]:
    bpm_match = BPM_RE.search(name)
    key_match = KEY_RE.search(name.replace("_", " "))
    result: dict[str, Any] = {}
    if bpm_match:
        result["bpm"] = int(bpm_match.group(1))
    if key_match:
        quality = (key_match.group(3) or "").lower()
        result["key"] = (
            key_match.group(1).upper()
            + key_match.group(2)
            + ("m" if quality in {"m", "min"} else "")
        )
    return result


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_catalog(root: Path) -> dict[str, Any]:
    path = root / "catalog.json"
    if not path.exists():
        return {"schema": "darksco.sound-library/1.0", "sounds": []}
    with path.open("r", encoding="utf-8-sig") as handle:
        catalog = json.load(handle)
    if catalog.get("schema") != "darksco.sound-library/1.0":
        raise ValueError(f"Unsupported sound library schema in {path}")
    return catalog


def save_catalog(root: Path, catalog: dict[str, Any]) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    path = root / "catalog.json"
    catalog["updated_at"] = datetime.now(timezone.utc).isoformat()
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(catalog, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return path


def iter_audio_files(source: Path) -> Iterable[Path]:
    if source.is_file():
        if source.suffix.lower() in AUDIO_EXTENSIONS:
            yield source
        return
    for path in sorted(source.rglob("*")):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            yield path


def import_sounds(
    source: Path,
    root: Path,
    *,
    provider: str,
    license_name: str,
    license_url: str = "",
    certificate: str = "",
) -> dict[str, int]:
    if not source.exists():
        raise FileNotFoundError(source)
    catalog = load_catalog(root)
    known = {item["sha256"] for item in catalog["sounds"]}
    imported = duplicates = 0
    for input_path in iter_audio_files(source):
        digest = sha256(input_path)
        if digest in known:
            duplicates += 1
            continue
        category = classify(input_path.stem)
        target_dir = root / "audio" / category
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / input_path.name
        if target.exists():
            target = target_dir / f"{input_path.stem}-{digest[:8]}{input_path.suffix.lower()}"
        shutil.copy2(input_path, target)
        record: dict[str, Any] = {
            "id": f"snd_{digest[:16]}",
            "name": input_path.stem,
            "path": target.relative_to(root).as_posix(),
            "category": category,
            "sha256": digest,
            "provider": provider,
            "license": license_name,
            "license_url": license_url,
            "certificate": certificate,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }
        record.update(infer_music_metadata(input_path.stem))
        catalog["sounds"].append(record)
        known.add(digest)
        imported += 1
    catalog["sounds"].sort(key=lambda item: (item["category"], item["name"].lower()))
    save_catalog(root, catalog)
    return {"imported": imported, "duplicates": duplicates, "total": len(catalog["sounds"])}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import licensed audio into the private Darksco sound library."
    )
    parser.add_argument("source", help="File or folder containing licensed WAV/AIFF/FLAC files")
    parser.add_argument("--library", default=str(default_library_root()))
    parser.add_argument("--provider", required=True, help="For example: Splice or Freesound")
    parser.add_argument("--license", required=True, dest="license_name")
    parser.add_argument("--license-url", default="")
    parser.add_argument("--certificate", default="")
    args = parser.parse_args()
    result = import_sounds(
        Path(args.source),
        Path(args.library),
        provider=args.provider,
        license_name=args.license_name,
        license_url=args.license_url,
        certificate=args.certificate,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
