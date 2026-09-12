from ableton_bridge.autostart import main
from ableton_bridge.config_migration import migrate_default_allowlist, migrate_local_loopback_auth
from ableton_bridge.desktop import ensure_config


if __name__ == "__main__":
    # Create the desktop config first so both fresh installs and upgrades can be
    # migrated before the local bridge process starts.
    ensure_config()
    migrate_default_allowlist()
    migrate_local_loopback_auth()
    main()
