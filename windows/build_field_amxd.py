from __future__ import annotations

import argparse
import struct
from pathlib import Path


def build_amxd(source: Path, output: Path) -> Path:
    payload = source.read_bytes()
    if not payload.rstrip().endswith(b"}"):
        raise ValueError(f"FIELD source does not look like Max patch JSON: {source}")

    # Max .amxd container used by Live 11/Max 8:
    # ampf + mmmm marker + meta chunk + ptch chunk containing UTF-8 patch JSON.
    patch_chunk = payload + b"\x00"
    container = b"".join(
        [
            b"ampf",
            struct.pack("<I", 4),
            b"mmmm",
            b"meta",
            struct.pack("<I", 4),
            struct.pack("<I", 1),
            b"ptch",
            struct.pack("<I", len(patch_chunk)),
            patch_chunk,
        ]
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(container)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Build DARKSCO FIELD .amxd from its validated .maxpat source.")
    parser.add_argument(
        "--source",
        default="max-for-live/darksco-field/DARKSCO-FIELD.maxpat",
    )
    parser.add_argument(
        "--output",
        default="max-for-live/darksco-field/DARKSCO FIELD.amxd",
    )
    args = parser.parse_args()
    output = build_amxd(Path(args.source), Path(args.output))
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
