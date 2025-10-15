"""Track last committed offsets per sensor."""

from __future__ import annotations

import threading
from typing import Dict


class OffsetTracker:
    def __init__(self) -> None:
        self._offsets: Dict[str, int] = {}
        self._lock = threading.Lock()

    def update(self, sensor_id: str, sequence: int) -> None:
        with self._lock:
            current = self._offsets.get(sensor_id, 0)
            if sequence > current:
                self._offsets[sensor_id] = sequence

    def get(self, sensor_id: str) -> int:
        with self._lock:
            return self._offsets.get(sensor_id, 0)

    def snapshot(self) -> Dict[str, int]:
        with self._lock:
            return dict(self._offsets)
