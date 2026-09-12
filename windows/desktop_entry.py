from ableton_bridge.autostart import main
from ableton_bridge.config_migration import migrate_default_allowlist


if __name__ == "__main__":
    migrate_default_allowlist()
    main()
