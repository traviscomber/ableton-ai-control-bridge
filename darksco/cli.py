from __future__ import annotations

import argparse
import json
from pathlib import Path

from ableton_bridge.commands import validate_command

from .compiler import compile_song_plan


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile a Darksco SongPlan to bridge JSONL.")
    parser.add_argument("plan")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    with Path(args.plan).open("r", encoding="utf-8") as handle:
        plan = json.load(handle)
    commands = [validate_command(command) for command in compile_song_plan(plan)]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        for command in commands:
            handle.write(json.dumps(command, separators=(",", ":")) + "\n")
    print(f"Compiled {len(commands)} command(s) to {output}")


if __name__ == "__main__":
    main()
