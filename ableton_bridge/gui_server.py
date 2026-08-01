from __future__ import annotations

from . import server
from .webui import CONTROL_UI


def main() -> None:
    server.APPROVAL_UI = CONTROL_UI
    server.main()


if __name__ == "__main__":
    main()
