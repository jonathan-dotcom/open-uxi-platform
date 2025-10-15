"""Request/ack handling logic for the sensor pipeline."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set

from ..common.messages import ChunkAck, ChunkRequest, DataChunk
from ..version import PIPELINE_SCHEMA_VERSION
from .queue import DurableQueue, QueuedChunk


@dataclass
class WindowState:
    window_id: str
    sequences: Set[int] = field(default_factory=set)
    opened_at: float = field(default_factory=time.time)


class ChunkDispatcher:
    def __init__(self, sensor_id: str, queue: DurableQueue) -> None:
        self._sensor_id = sensor_id
        self._queue = queue
        self._windows: Dict[str, WindowState] = {}
        self._in_flight: Dict[int, str] = {}
        self._last_ack_sequence: int = 0

    @property
    def last_ack_sequence(self) -> int:
        return self._last_ack_sequence

    def queue_depth(self) -> int:
        return self._queue.queue_depth()

    def _track_window(self, window_id: str, sequence: int) -> None:
        state = self._windows.setdefault(window_id, WindowState(window_id=window_id))
        state.sequences.add(sequence)
        self._in_flight[sequence] = window_id

    def _release_sequence(self, sequence: int) -> None:
        window_id = self._in_flight.pop(sequence, None)
        if not window_id:
            return
        window = self._windows.get(window_id)
        if not window:
            return
        window.sequences.discard(sequence)
        if not window.sequences:
            self._windows.pop(window_id, None)

    def build_chunks(self, request: ChunkRequest) -> List[DataChunk]:
        records = self._queue.peek_window(
            since_sequence=request.since_sequence,
            max_chunks=request.max_chunks,
            max_bytes=request.max_bytes,
        )
        to_send: List[DataChunk] = []
        for record in records:
            if (
                record.sequence in self._in_flight
                and self._in_flight[record.sequence] != request.window_id
            ):
                # Already being tracked by a different window; let the server
                # resolve via retry/ack before resending.
                continue

            if request.max_in_flight > 0 and len(self._in_flight) >= request.max_in_flight:
                break

            chunk = self._to_data_chunk(record)
            chunk.attributes["window_id"] = request.window_id
            to_send.append(chunk)
            self._track_window(request.window_id, record.sequence)
        return to_send

    def _to_data_chunk(self, record: QueuedChunk) -> DataChunk:
        created_iso = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created_at)
        )
        return DataChunk(
            schema_version=PIPELINE_SCHEMA_VERSION,
            sensor_id=self._sensor_id,
            event_id=record.event_id,
            sequence=record.sequence,
            chunk_index=record.chunk_index,
            chunk_count=record.chunk_count,
            compression=record.compression,
            payload=record.payload,
            chunk_sha256=record.chunk_hash,
            event_sha256=record.event_hash,
            created_at=created_iso,
            logical_timestamp_ms=record.logical_timestamp_ms,
            clock_skew_ms=record.clock_skew_ms,
            attributes={
                k: v
                for k, v in record.attributes.items()
                if k != "schema_version_override"
            },
        )

    def handle_ack(self, ack: ChunkAck) -> Dict[str, int]:
        deleted = 0
        committed_sequences = sorted(set(int(seq) for seq in ack.committed_sequences))
        if ack.reset_window:
            self._windows.pop(ack.window_id, None)
        deleted = self._queue.delete_sequences(committed_sequences)
        for seq in committed_sequences:
            self._release_sequence(seq)
        if committed_sequences:
            self._last_ack_sequence = max(self._last_ack_sequence, committed_sequences[-1])
        return {"deleted": deleted, "remaining": self._queue.queue_depth()}
