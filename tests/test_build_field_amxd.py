from __future__ import annotations

import struct
from pathlib import Path

from windows.build_field_amxd import build_amxd


def test_build_field_amxd_wraps_patch_json(tmp_path: Path) -> None:
    source = tmp_path / "FIELD.maxpat"
    source.write_text('{"patcher":{"boxes":[]}}', encoding="utf-8")
    output = tmp_path / "FIELD.amxd"

    build_amxd(source, output)
    payload = output.read_bytes()

    assert payload[:4] == b"ampf"
    assert payload[8:12] == b"mmmm"
    assert payload[12:16] == b"meta"
    assert payload[24:28] == b"ptch"
    chunk_length = struct.unpack("<I", payload[28:32])[0]
    assert chunk_length == len(payload) - 32
    assert payload[32:].endswith(b"\x00")
    assert b'"patcher"' in payload[32:]
