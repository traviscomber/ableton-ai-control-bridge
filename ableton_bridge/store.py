from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class CommandStore:
    def __init__(self, path: str = ".ableton-bridge/history.sqlite3"):
        self.path = path
        self._lock = threading.Lock()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def _database(self):
        """Commit and always close SQLite handles (required on Windows)."""
        db = self._connect()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def _initialize(self) -> None:
        with self._database() as db:
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS commands (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    command_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    result TEXT,
                    error TEXT,
                    source TEXT NOT NULL,
                    undo_of TEXT
                )
                """
            )

    def create(self, payload: dict[str, Any], status: str, source: str) -> dict[str, Any]:
        command_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._database() as db:
            db.execute(
                "INSERT INTO commands VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)",
                (command_id, now, now, status, payload["type"], json.dumps(payload), source),
            )
        return self.get(command_id)

    def update(
        self,
        command_id: str,
        status: str,
        *,
        result: Any = None,
        error: str | None = None,
        undo_of: str | None = None,
    ) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._database() as db:
            db.execute(
                """UPDATE commands SET updated_at=?, status=?, result=?, error=?,
                   undo_of=COALESCE(?, undo_of) WHERE id=?""",
                (now, status, json.dumps(result) if result is not None else None, error, undo_of, command_id),
            )
        return self.get(command_id)

    def get(self, command_id: str) -> dict[str, Any] | None:
        with self._database() as db:
            row = db.execute("SELECT * FROM commands WHERE id=?", (command_id,)).fetchone()
        return self._decode(row) if row else None

    def list(self, *, status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        query = "SELECT * FROM commands"
        values: list[Any] = []
        if status:
            query += " WHERE status=?"
            values.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"
        values.append(max(1, min(limit, 500)))
        with self._database() as db:
            rows = db.execute(query, values).fetchall()
        return [self._decode(row) for row in rows]

    @staticmethod
    def _decode(row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        item["payload"] = json.loads(item["payload"])
        item["result"] = json.loads(item["result"]) if item["result"] else None
        return item
