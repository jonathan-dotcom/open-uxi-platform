"""Snapshot cache storing most recent per-sensor payloads."""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from typing import Dict, Optional

from .store import IngestResult


@dataclass
class Snapshot:
    sensor_id: str
    event_id: str
    payload: bytes
    logical_timestamp_ms: int
    updated_at: float

    def as_json(self) -> dict:
        try:
            return json.loads(self.payload.decode("utf-8"))
        except Exception:
            return {}


class SnapshotCache:
    def __init__(self) -> None:
        self._snapshots: Dict[str, Snapshot] = {}
        self._lock = threading.Lock()

    def update_from_ingest(self, ingest: IngestResult) -> Optional[Snapshot]:
        if not ingest.event_complete or not ingest.assembled_payload:
            return None
        snapshot = Snapshot(
            sensor_id=ingest.sensor_id,
            event_id=ingest.event_id,
            payload=ingest.assembled_payload,
            logical_timestamp_ms=ingest.logical_timestamp_ms,
            updated_at=time.time(),
        )
        with self._lock:
            self._snapshots[ingest.sensor_id] = snapshot
        return snapshot

    def get(self, sensor_id: str) -> Optional[Snapshot]:
        with self._lock:
            return self._snapshots.get(sensor_id)

    def all(self) -> Dict[str, Snapshot]:
        with self._lock:
            return dict(self._snapshots)
