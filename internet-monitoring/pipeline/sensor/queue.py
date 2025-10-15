"""Crash-safe queue for outbound chunks on the sensor."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence

from ..common.chunking import EventChunk


@dataclass(frozen=True)
class QueuedChunk:
    sequence: int
    event_id: str
    chunk_index: int
    chunk_count: int
    compression: str
    payload: bytes
    chunk_hash: bytes
    event_hash: bytes
    created_at: float
    logical_timestamp_ms: int
    clock_skew_ms: float
    attributes: dict

    @property
    def payload_size(self) -> int:
        return len(self.payload)


class DurableQueue:
    def __init__(
        self,
        db_path: str | Path,
        *,
        retention_seconds: int = 72 * 3600,
    ) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._retention_seconds = retention_seconds
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(
            self._path,
            isolation_level=None,
            check_same_thread=False,
        )
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._init_schema()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    chunk_count INTEGER NOT NULL,
                    compression TEXT NOT NULL,
                    payload BLOB NOT NULL,
                    chunk_hash BLOB NOT NULL,
                    event_hash BLOB NOT NULL,
                    created_at REAL NOT NULL,
                    logical_timestamp_ms INTEGER NOT NULL,
                    clock_skew_ms REAL NOT NULL,
                    attributes TEXT NOT NULL
                );
                """
            )
            self._conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chunks_event
                ON chunks(event_id, chunk_index);
                """
            )

    def enqueue(self, chunks: Sequence[EventChunk]) -> List[QueuedChunk]:
        now = time.time()
        queued: List[QueuedChunk] = []
        with self._lock, self._conn:
            for chunk in chunks:
                cursor = self._conn.execute(
                    """
                    INSERT INTO chunks (
                        event_id,
                        chunk_index,
                        chunk_count,
                        compression,
                        payload,
                        chunk_hash,
                        event_hash,
                        created_at,
                        logical_timestamp_ms,
                        clock_skew_ms,
                        attributes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        chunk.event_id,
                        chunk.chunk_index,
                        chunk.chunk_count,
                        chunk.compression,
                        chunk.payload,
                        chunk.chunk_hash,
                        chunk.event_hash,
                        now,
                        chunk.logical_timestamp_ms,
                        chunk.clock_skew_ms,
                        json.dumps(chunk.attributes or {}),
                    ),
                )
                seq = cursor.lastrowid
                queued.append(
                    QueuedChunk(
                        sequence=seq,
                        event_id=chunk.event_id,
                        chunk_index=chunk.chunk_index,
                        chunk_count=chunk.chunk_count,
                        compression=chunk.compression,
                        payload=chunk.payload,
                        chunk_hash=chunk.chunk_hash,
                        event_hash=chunk.event_hash,
                        created_at=now,
                        logical_timestamp_ms=chunk.logical_timestamp_ms,
                        clock_skew_ms=chunk.clock_skew_ms,
                        attributes=chunk.attributes,
                    )
                )
            self._prune_locked(now)
        return queued

    def peek_window(
        self,
        *,
        since_sequence: int,
        max_chunks: int,
        max_bytes: int,
    ) -> List[QueuedChunk]:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                """
                SELECT sequence,
                       event_id,
                       chunk_index,
                       chunk_count,
                       compression,
                       payload,
                       chunk_hash,
                       event_hash,
                       created_at,
                       logical_timestamp_ms,
                       clock_skew_ms,
                       attributes
                FROM chunks
                WHERE sequence > ?
                ORDER BY sequence ASC
                LIMIT ?;
                """,
                (since_sequence, max_chunks * 2),
            )
            rows = cursor.fetchall()

        window: List[QueuedChunk] = []
        total_bytes = 0
        for row in rows:
            (
                sequence,
                event_id,
                chunk_index,
                chunk_count,
                compression,
                payload,
                chunk_hash,
                event_hash,
                created_at,
                logical_timestamp_ms,
                clock_skew_ms,
                attributes_json,
            ) = row
            payload_bytes = len(payload)
            if payload_bytes > max_bytes and not window:
                # Always send at least one chunk even if it exceeds the window.
                limit_ok = True
            else:
                limit_ok = total_bytes + payload_bytes <= max_bytes

            if len(window) >= max_chunks or not limit_ok:
                break

            window.append(
                QueuedChunk(
                    sequence=sequence,
                    event_id=event_id,
                    chunk_index=chunk_index,
                    chunk_count=chunk_count,
                    compression=compression,
                    payload=payload,
                    chunk_hash=chunk_hash,
                    event_hash=event_hash,
                    created_at=created_at,
                    logical_timestamp_ms=logical_timestamp_ms,
                    clock_skew_ms=clock_skew_ms,
                    attributes=json.loads(attributes_json or "{}"),
                )
            )
            total_bytes += payload_bytes
        return window

    def delete_sequences(self, sequences: Iterable[int]) -> int:
        seq_list = list(sequences)
        if not seq_list:
            return 0
        with self._lock, self._conn:
            result = self._conn.execute(
                f"DELETE FROM chunks WHERE sequence IN ({','.join('?' for _ in seq_list)});",
                seq_list,
            )
        return result.rowcount

    def queue_depth(self) -> int:
        with self._lock, self._conn:
            cursor = self._conn.execute("SELECT COUNT(*) FROM chunks;")
            return int(cursor.fetchone()[0])

    def oldest_age_seconds(self) -> float:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "SELECT MIN(created_at) FROM chunks;"
            )
            row = cursor.fetchone()
            if row is None or row[0] is None:
                return 0.0
            return max(0.0, time.time() - float(row[0]))

    def last_sequence(self) -> int:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "SELECT MAX(sequence) FROM chunks;"
            )
            row = cursor.fetchone()
            if row is None or row[0] is None:
                return 0
            return int(row[0])

    def _prune_locked(self, now: float) -> None:
        cutoff = now - self._retention_seconds
        self._conn.execute(
            "DELETE FROM chunks WHERE created_at < ?;",
            (cutoff,),
        )
