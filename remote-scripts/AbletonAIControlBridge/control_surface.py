"""Experimental Live 11 Remote Script for loading native browser devices."""

from __future__ import annotations

import json
import socket
import struct

from _Framework.ControlSurface import ControlSurface

HOST = "127.0.0.1"
PORT = 9003
ACK_HOST = "127.0.0.1"
ACK_PORT = 9002


def _osc_string(value):
    raw = value.encode("utf-8") + b"\0"
    return raw + (b"\0" * ((4 - len(raw) % 4) % 4))


def _read_osc_string(packet, offset):
    end = packet.find(b"\0", offset)
    if end < 0:
        raise ValueError("Invalid OSC packet")
    value = packet[offset:end].decode("utf-8")
    return value, (end + 4) & ~3


def decode_command(packet):
    address, offset = _read_osc_string(packet, 0)
    tags, offset = _read_osc_string(packet, offset)
    if address != "/bridge" or tags != ",s":
        raise ValueError("Expected /bridge OSC string")
    raw, _ = _read_osc_string(packet, offset)
    return json.loads(raw)


def encode_ack(payload):
    return _osc_string("/bridge_ack") + _osc_string(",s") + _osc_string(
        json.dumps(payload, separators=(",", ":"))
    )


class AbletonAIControlBridge(ControlSurface):
    def __init__(self, c_instance):
        super(AbletonAIControlBridge, self).__init__(c_instance)
        self._bridge_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._bridge_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._bridge_socket.bind((HOST, PORT))
        self._bridge_socket.setblocking(False)
        self.log_message("Ableton AI Control Bridge Remote Script listening on 127.0.0.1:9003")
        self.schedule_message(1, self._poll_bridge)

    def disconnect(self):
        try:
            self._bridge_socket.close()
        finally:
            super(AbletonAIControlBridge, self).disconnect()

    def _poll_bridge(self):
        try:
            while True:
                packet, _ = self._bridge_socket.recvfrom(65535)
                self._execute(packet)
        except (BlockingIOError, OSError):
            pass
        finally:
            self.schedule_message(1, self._poll_bridge)

    def _execute(self, packet):
        command = {}
        try:
            command = decode_command(packet)
            if command.get("type") != "load_native_device":
                raise ValueError("Unsupported Remote Script command: %s" % command.get("type"))
            result = self._load_native_device(command)
            payload = {"bridge_id": command.get("bridge_id"), "ok": True, "result": result}
        except Exception as exc:
            payload = {
                "bridge_id": command.get("bridge_id"),
                "ok": False,
                "error": "%s" % exc,
            }
            self.log_message("Ableton AI Control Bridge error: %s" % exc)
        sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sender.sendto(encode_ack(payload), (ACK_HOST, ACK_PORT))
        finally:
            sender.close()

    def _target(self, kind, name):
        song = self.song()
        if kind == "master":
            return song.master_track
        collection = song.return_tracks if kind == "return" else song.tracks
        desired = name.strip().lower()
        for target in collection:
            if target.name.strip().lower() == desired:
                return target
        raise RuntimeError("%s target not found: %s" % (kind, name))

    def _find_item(self, root, desired):
        desired = desired.strip().lower()
        queue = list(getattr(root, "children", ()))
        partial = None
        while queue:
            item = queue.pop(0)
            name = str(getattr(item, "name", "")).strip().lower()
            if name == desired:
                return item
            if partial is None and desired in name:
                partial = item
            queue.extend(list(getattr(item, "children", ())))
        return partial

    def _load_native_device(self, command):
        browser = self.application().browser
        category = command["category"]
        root = {
            "instrument": browser.instruments,
            "audio_effect": browser.audio_effects,
            "midi_effect": browser.midi_effects,
        }[category]
        item = self._find_item(root, command["device"])
        if item is None:
            raise RuntimeError("Browser item not found: %s" % command["device"])
        target = self._target(command["target_kind"], command["target_name"])
        self.song().view.selected_track = target
        browser.load_item(item)
        return {
            "target_kind": command["target_kind"],
            "target_name": command["target_name"],
            "device": str(item.name),
        }
