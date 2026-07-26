# Bridge Preflight Diagnostics

Use the preflight command before starting production work or executing an autonomous SongPlan.

```bash
ableton-bridge-check
```

The check reports:

- Supported Python version.
- Configuration file validity.
- Bridge health endpoint availability.
- Token availability when authentication is enabled.
- HTTP port availability when the bridge is offline.
- UDP target and ACK listener configuration.
- Whether the Max for Live receiver has acknowledged the bridge.

## Common modes

Check a running bridge:

```bash
ableton-bridge-check
```

Require a confirmed Max receiver acknowledgement:

```bash
ableton-bridge-check --require-receiver
```

Use a configuration file:

```bash
ableton-bridge-check --config config.json
```

Return machine-readable output:

```bash
ableton-bridge-check --json
```

Use a custom health endpoint:

```bash
ableton-bridge-check --health-url http://127.0.0.1:8765/health
```

## Exit behavior

- Exit code `0`: no required check failed.
- Exit code `1`: at least one required check failed.

An offline bridge is reported as a warning rather than a failure when its configured HTTP port is available. This allows the command to be used before the bridge starts.

Use `--require-receiver` for release verification, smoke tests, or autonomous execution. Without this option, a missing receiver acknowledgement is a warning.

## Recommended first-run sequence

1. Run `ableton-bridge-check` before starting the server.
2. Start the bridge with the required token and approval policy.
3. Load `AI Control Bridge Receiver` in Ableton Live.
4. Send one safe smoke command.
5. Run `ableton-bridge-check --require-receiver`.
6. Execute the validated SongPlan only when the report passes.
