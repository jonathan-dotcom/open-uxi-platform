"""Utilities for issuing chunk requests on demand or on schedule."""

from __future__ import annotations

import asyncio
import time
from typing import Iterable, Optional

from .control import ControlManager
from .offsets import OffsetTracker


class RequestScheduler:
    def __init__(
        self,
        control: ControlManager,
        offsets: OffsetTracker,
        *,
        max_chunks: int = 32,
        max_bytes: int = 2 * 1024 * 1024,
        max_in_flight: int = 32,
    ) -> None:
        self._control = control
        self._offsets = offsets
        self._max_chunks = max_chunks
        self._max_bytes = max_bytes
        self._max_in_flight = max_in_flight

    async def request_sensor(
        self,
        sensor_id: str,
        *,
        window_id: Optional[str] = None,
        since_sequence: Optional[int] = None,
        max_chunks: Optional[int] = None,
        max_bytes: Optional[int] = None,
    ) -> bool:
        window_id = window_id or f"{sensor_id}-{int(time.time() * 1000)}"
        since = (
            since_sequence
            if since_sequence is not None
            else self._offsets.get(sensor_id)
        )
        return await self._control.send_chunk_request(
            sensor_id,
            since_sequence=since,
            max_chunks=max_chunks or self._max_chunks,
            max_bytes=max_bytes or self._max_bytes,
            window_id=window_id,
            max_in_flight=self._max_in_flight,
        )

    async def request_sensors(self, sensor_ids: Iterable[str]) -> None:
        await asyncio.gather(*(self.request_sensor(sensor_id) for sensor_id in sensor_ids))
