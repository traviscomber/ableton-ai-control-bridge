from __future__ import annotations

import sys

from .desktop import BridgeDesktop, main as desktop_main, read_health


def main() -> None:
    if "--server" in sys.argv:
        desktop_main()
        return

    app = BridgeDesktop()

    def wait_for_bridge(attempt: int = 0) -> None:
        if read_health():
            app.open_ui()
            return
        if attempt < 60:
            app.root.after(200, lambda: wait_for_bridge(attempt + 1))
        else:
            app.write("ERROR: bridge did not become ready automatically.")

    def start_automatically() -> None:
        app.start()
        app.root.after(200, wait_for_bridge)

    app.root.after(350, start_automatically)
    app.run()


if __name__ == "__main__":
    main()
