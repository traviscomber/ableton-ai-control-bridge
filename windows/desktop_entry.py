from __future__ import annotations

import sys

from ableton_bridge.autostart import main
from ableton_bridge.commands import COMMANDS


def _self_test_command(argv: list[str]) -> int | None:
    if len(argv) == 3 and argv[1] == "--self-test-command":
        return 0 if argv[2] in COMMANDS else 2
    return None


if __name__ == "__main__":
    result = _self_test_command(sys.argv)
    if result is not None:
        raise SystemExit(result)
    main()
