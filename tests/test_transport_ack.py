import json

from ableton_bridge.transport import decode_ack_packet, encode_osc


def test_decode_ack_packet_accepts_osc_ack() -> None:
    payload = {"bridge_id": "abc", "ok": True, "result": {"tempo": 120}}
    raw = encode_osc("/bridge_ack", json.dumps(payload, separators=(",", ":")))

    assert decode_ack_packet(raw) == payload


def test_decode_ack_packet_accepts_max_text_ack() -> None:
    payload = {"bridge_id": "abc", "ok": True, "result": {"track": 0}}
    raw = (
        "/bridge_ack " + json.dumps(payload, separators=(",", ":")) + ";"
    ).encode("utf-8")

    assert decode_ack_packet(raw) == payload


def test_decode_ack_packet_accepts_symbol_text_ack() -> None:
    payload = {"bridge_id": "abc", "ok": False, "error": "Device not found"}
    raw = ("symbol " + json.dumps(payload, separators=(",", ":")) + ";").encode("utf-8")

    assert decode_ack_packet(raw) == payload


def test_decode_ack_packet_rejects_other_osc_address() -> None:
    raw = encode_osc("/other", '{"ok":true}')

    assert decode_ack_packet(raw) is None


def test_decode_ack_packet_rejects_invalid_text() -> None:
    assert decode_ack_packet(b"/bridge_ack not-json;") is None
