from __future__ import annotations

import argparse
import json

from .instruments.field_intent import compile_field_intent, parse_field_phrase


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compile a deterministic DARKSCO FIELD musical phrase to bridge JSONL."
    )
    parser.add_argument("phrase", help='Example: "night, deeper, less motion, more space"')
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--track", type=int)
    target.add_argument("--track-ref")
    args = parser.parse_args()

    intent = parse_field_phrase(args.phrase)
    commands = compile_field_intent(intent, track=args.track, track_ref=args.track_ref)
    for command in commands:
        print(json.dumps(command, separators=(",", ":")))


if __name__ == "__main__":
    main()
