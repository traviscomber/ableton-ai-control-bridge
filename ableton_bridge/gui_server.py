from __future__ import annotations

from . import server
from .webui_pro import PRO_CONTROL_UI


def main() -> None:
    server.APPROVAL_UI = PRO_CONTROL_UI
    server.main()


if __name__ == "__main__":
    main()
