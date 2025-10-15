"""Server-side durable ingest store with dedupe and chunk assembly."""

from __future__ import annotations

import gzip
import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Tuple

from ..common.messages import DataChunk


@dataclass
class IngestResult:
    stored: bool
    duplicate: bool
    sequence: int
    event_id: str
    sensor_id: str
    logical_timestamp_ms: int
    event_complete: bool
    assembled_payload: Optional[bytes] = None


class ChunkStore:
    def __init__(
        self,
        db_path: str | Path,
        *,
        retention_seconds: int = 72 * 3600,
    ) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._retention_seconds = retention_seconds
        self._conn = sqlite3.connect(
            self._path,
            isolation_level=None,
            check_same_thread=False,
        )
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._init_schema()

    def close(self) -> None:
        self._conn.close()

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    sensor_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    event_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    chunk_count INTEGER NOT NULL,
                    compression TEXT NOT NULL,
                    payload BLOB NOT NULL,
                    chunk_sha256 BLOB NOT NULL,
                    event_sha256 BLOB NOT NULL,
                    created_at TEXT NOT NULL,
                    logical_timestamp_ms INTEGER NOT NULL,
                    clock_skew_ms REAL NOT NULL,
                    attributes TEXT NOT NULL,
                    PRIMARY KEY (sensor_id, sequence)
                );
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    sensor_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    chunk_count INTEGER NOT NULL,
                    event_sha256 BLOB NOT NULL,
                    received_chunks INTEGER NOT NULL,
                    logical_timestamp_ms INTEGER NOT NULL,
                    clock_skew_ms REAL NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    completed_at REAL,
                    PRIMARY KEY (sensor_id, event_id)
                );
                """
            )
            self._conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chunks_event
                ON chunks(sensor_id, event_id, chunk_index);
                """
            )

    def ingest(self, chunk: DataChunk) -> IngestResult:
        now = time.time()
        payload_bytes = chunk.payload
        if chunk.compression == "gzip":
            if hashlib.sha256(payload_bytes).digest() != chunk.chunk_sha256:
                raise ValueError("chunk hash mismatch")
        else:
            raise ValueError(f"unsupported compression {chunk.compression}")

        with self._conn:
            cursor = self._conn.execute(
                """
                SELECT 1 FROM chunks WHERE sensor_id = ? AND sequence = ?;
                """,
                (chunk.sensor_id, chunk.sequence),
            )
            if cursor.fetchone():
                return IngestResult(
                    stored=False,
                    duplicate=True,
                    sequence=chunk.sequence,
                    event_id=chunk.event_id,
                    sensor_id=chunk.sensor_id,
                    logical_timestamp_ms=chunk.logical_timestamp_ms,
                    event_complete=self._event_complete(chunk.sensor_id, chunk.event_id),
                )

            self._conn.execute(
                """
                INSERT INTO chunks (
                    sensor_id,
                    sequence,
                    event_id,
                    chunk_index,
                    chunk_count,
                    compression,
                    payload,
                    chunk_sha256,
                    event_sha256,
                    created_at,
                    logical_timestamp_ms,
                    clock_skew_ms,
                    attributes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    chunk.sensor_id,
                    chunk.sequence,
                    chunk.event_id,
                    chunk.chunk_index,
                    chunk.chunk_count,
                    chunk.compression,
                    chunk.payload,
                    chunk.chunk_sha256,
                    chunk.event_sha256,
                    chunk.created_at,
                    chunk.logical_timestamp_ms,
                    chunk.clock_skew_ms,
                    json.dumps(chunk.attributes),
                ),
            )

            event_row = self._conn.execute(
                """
                SELECT chunk_count, event_sha256, received_chunks
                FROM events
                WHERE sensor_id = ? AND event_id = ?;
                """,
                (chunk.sensor_id, chunk.event_id),
            ).fetchone()

            if event_row:
                existing_count, existing_hash, received = event_row
                if existing_hash != chunk.event_sha256:
                    raise ValueError("event hash mismatch")
                if existing_count != chunk.chunk_count:
                    raise ValueError("chunk count mismatch")
                received += 1
                self._conn.execute(
                    """
                    UPDATE events
                    SET received_chunks = ?, updated_at = ?
                    WHERE sensor_id = ? AND event_id = ?;
                    """,
                    (
                        received,
                        now,
                        chunk.sensor_id,
                        chunk.event_id,
                    ),
                )
            else:
                received = 1
                self._conn.execute(
                    """
                    INSERT INTO events (
                        sensor_id,
                        event_id,
                        chunk_count,
                        event_sha256,
                        received_chunks,
                        logical_timestamp_ms,
                        clock_skew_ms,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        chunk.sensor_id,
                        chunk.event_id,
                        chunk.chunk_count,
                        chunk.event_sha256,
                        received,
                        chunk.logical_timestamp_ms,
                        chunk.clock_skew_ms,
                        now,
                        now,
                    ),
                )

            event_complete = received >= chunk.chunk_count
            assembled_payload = None
            if event_complete:
                self._conn.execute(
                    """
                    UPDATE events
                    SET completed_at = ?, updated_at = ?
                    WHERE sensor_id = ? AND event_id = ?;
                    """,
                    (now, now, chunk.sensor_id, chunk.event_id),
                )
                assembled_payload = self._assemble_event(chunk.sensor_id, chunk.event_id)
                if hashlib.sha256(assembled_payload).digest() != chunk.event_sha256:
                    raise ValueError("event payload hash mismatch")
            self._prune_locked(now)

        return IngestResult(
            stored=True,
            duplicate=False,
            sequence=chunk.sequence,
            event_id=chunk.event_id,
            sensor_id=chunk.sensor_id,
            logical_timestamp_ms=chunk.logical_timestamp_ms,
            event_complete=event_complete,
            assembled_payload=assembled_payload,
        )

    def _assemble_event(self, sensor_id: str, event_id: str) -> bytes:
        cursor = self._conn.execute(
            """
            SELECT payload, compression
            FROM chunks
            WHERE sensor_id = ? AND event_id = ?
            ORDER BY chunk_index ASC;
            """,
            (sensor_id, event_id),
        )
        parts = []
        for payload, compression in cursor.fetchall():
            if compression == "gzip":
                parts.append(gzip.decompress(payload))
            else:
                raise ValueError(f"unsupported compression {compression}")
        return b"".join(parts)

    def _event_complete(self, sensor_id: str, event_id: str) -> bool:
        cursor = self._conn.execute(
            """
            SELECT completed_at
            FROM events
            WHERE sensor_id = ? AND event_id = ?;
            """,
            (sensor_id, event_id),
        )
        row = cursor.fetchone()
        return bool(row and row[0] is not None)

    def _prune_locked(self, now: float) -> None:
        cutoff = now - self._retention_seconds
        self._conn.execute(
            """
            DELETE FROM events WHERE completed_at IS NOT NULL AND completed_at < ?;
            """,
            (cutoff,),
        )
        self._conn.execute(
            """
            DELETE FROM chunks
            WHERE sequence IN (
                SELECT c.sequence
                FROM chunks c
                JOIN events e ON c.sensor_id = e.sensor_id AND c.event_id = e.event_id
                WHERE e.completed_at IS NOT NULL AND e.completed_at < ?
            );
            """,
            (cutoff,),
        )
