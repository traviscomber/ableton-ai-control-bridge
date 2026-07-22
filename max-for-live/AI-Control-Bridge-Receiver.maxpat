{
  "patcher": {
    "fileversion": 1,
    "appversion": {"major": 8, "minor": 5, "revision": 0, "architecture": "x64"},
    "classnamespace": "box",
    "rect": [80.0, 80.0, 820.0, 430.0],
    "openinpresentation": 1,
    "boxes": [
      {"box": {"id": "in", "maxclass": "newobj", "text": "udpreceive 9001", "patching_rect": [40.0, 55.0, 120.0, 22.0]}},
      {"box": {"id": "route", "maxclass": "newobj", "text": "route /bridge", "patching_rect": [40.0, 95.0, 90.0, 22.0]}},
      {"box": {"id": "tosymbol", "maxclass": "newobj", "text": "tosymbol", "patching_rect": [40.0, 135.0, 70.0, 22.0]}},
      {"box": {"id": "deserialize", "maxclass": "newobj", "text": "dict.deserialize", "patching_rect": [40.0, 175.0, 105.0, 22.0]}},
      {"box": {"id": "engine", "maxclass": "newobj", "text": "js bridge_receiver.js", "patching_rect": [40.0, 215.0, 145.0, 22.0]}},
      {"box": {"id": "ack", "maxclass": "newobj", "text": "udpsend 127.0.0.1 9002", "patching_rect": [40.0, 265.0, 165.0, 22.0]}},
      {"box": {"id": "log", "maxclass": "newobj", "text": "print ableton-ai-bridge", "patching_rect": [240.0, 245.0, 145.0, 22.0]}},
      {"box": {"id": "title", "maxclass": "comment", "text": "Ableton AI Control Bridge Receiver", "fontsize": 18.0, "presentation": 1, "presentation_rect": [20.0, 18.0, 350.0, 28.0], "patching_rect": [280.0, 55.0, 350.0, 28.0]}},
      {"box": {"id": "status", "maxclass": "comment", "text": "UDP commands: 9001 · acknowledgements: 9002", "presentation": 1, "presentation_rect": [20.0, 58.0, 380.0, 22.0], "patching_rect": [280.0, 100.0, 380.0, 22.0]}},
      {"box": {"id": "help", "maxclass": "comment", "text": "Keep this device loaded in the Live Set while the Python bridge is running.", "presentation": 1, "presentation_rect": [20.0, 88.0, 520.0, 22.0], "patching_rect": [280.0, 145.0, 470.0, 22.0]}}
    ],
    "lines": [
      {"patchline": {"source": ["in", 0], "destination": ["route", 0]}},
      {"patchline": {"source": ["route", 0], "destination": ["tosymbol", 0]}},
      {"patchline": {"source": ["tosymbol", 0], "destination": ["deserialize", 0]}},
      {"patchline": {"source": ["deserialize", 0], "destination": ["engine", 0]}},
      {"patchline": {"source": ["engine", 0], "destination": ["ack", 0]}},
      {"patchline": {"source": ["engine", 1], "destination": ["log", 0]}}
    ]
  }
}
