"""Asynchronous sensor agent wiring queue, control channel, and chunk sender."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Iterable, Optional

from ..common.backoff import ExponentialBackoff
from ..common.messages import (
    ChunkAck,
    ChunkRequest,
    ControlEnvelope,
    DataChunk,
    Heartbeat,
)
from ..version import PIPELINE_SCHEMA_VERSION
from .dispatch import ChunkDispatcher
from .interfaces import ChunkSender, ControlChannel
from .queue import DurableQueue
from .time_sync import ClockSkewEstimator

LOGGER = logging.getLogger(__name__)


class SensorAgent:
    def __init__(
        self,
        sensor_id: str,
        *,
        dispatcher: ChunkDispatcher,
        control_channel: ControlChannel,
        chunk_sender: ChunkSender,
        queue: DurableQueue,
        software_version: str,
        heartbeat_interval: float = 30.0,
        capabilities: Optional[Iterable[str]] = None,
        clock_skew: Optional[ClockSkewEstimator] = None,
    ) -> None:
        self._sensor_id = sensor_id
        self._dispatcher = dispatcher
        self._control = control_channel
        self._chunk_sender = chunk_sender
        self._queue = queue
        self._software_version = software_version
        self._heartbeat_interval = heartbeat_interval
        self._capabilities = list(capabilities or ["chunks", "heartbeats"])
        self._clock_skew = clock_skew or ClockSkewEstimator(enabled=False)
        self._backoff = ExponentialBackoff()
        self._stop_event = asyncio.Event()

    async def run(self) -> None:
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        handshake_pending = True
        try:
            while not self._stop_event.is_set():
                try:
                    if handshake_pending:
                        await self._send_heartbeat()
                        handshake_pending = False
                    envelope = await self._control.recv()
                except Exception as exc:
                    LOGGER.exception("control channel receive failed: %s", exc)
                    await self._control.close()
                    await asyncio.sleep(self._backoff.next_interval())
                    handshake_pending = True
                    continue
                self._backoff.reset()
                await self._handle_control(envelope)
        finally:
            self._stop_event.set()
            heartbeat_task.cancel()
            with contextlib.suppress(Exception):
                await heartbeat_task
            await self._control.close()

    async def shutdown(self) -> None:
        self._stop_event.set()
        await self._control.close()

    async def _handle_control(self, envelope: ControlEnvelope) -> None:
        if envelope.body_type == "chunk_request":
            await self._handle_chunk_request(envelope.body)  # type: ignore[arg-type]
        elif envelope.body_type == "chunk_ack":
            stats = self._dispatcher.handle_ack(envelope.body)  # type: ignore[arg-type]
            LOGGER.debug("ack processed %s", stats)
        elif envelope.body_type == "heartbeat":
            LOGGER.debug("received server heartbeat %s", envelope.body)
        elif envelope.body_type == "command_response":
            LOGGER.info("server acked command: %s", envelope.body)
        else:
            LOGGER.warning("unknown control body %s", envelope.body_type)

    async def _handle_chunk_request(self, request: ChunkRequest) -> None:
        chunks = self._dispatcher.build_chunks(request)
        if not chunks:
            LOGGER.debug(
                "no chunks for request window=%s since=%d",
                request.window_id,
                request.since_sequence,
            )
            return
        for chunk in chunks:
            await self._send_chunk_with_backoff(chunk)

    async def _send_chunk_with_backoff(self, chunk: DataChunk) -> None:
        backoff = ExponentialBackoff()
        while True:
            try:
                await self._chunk_sender.send_chunk(chunk)
                return
            except Exception as exc:
                LOGGER.warning(
                    "failed to send chunk seq=%d retrying: %s",
                    chunk.sequence,
                    exc,
                )
                await asyncio.sleep(backoff.next_interval())

    async def _heartbeat_loop(self) -> None:
        while not self._stop_event.is_set():
            await self._send_heartbeat()
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(), timeout=self._heartbeat_interval
                )
            except asyncio.TimeoutError:
                continue

    async def _send_heartbeat(self) -> None:
        skew = self._clock_skew.estimate()
        heartbeat = Heartbeat(
            software_version=self._software_version,
            last_committed_sequence=self._dispatcher.last_ack_sequence,
            queue_depth=self._dispatcher.queue_depth(),
            clock_skew_ms=skew,
        )
        envelope = ControlEnvelope(
            sensor_id=self._sensor_id,
            body_type="heartbeat",
            body=heartbeat,
            capabilities=self._capabilities,
            schema_version=PIPELINE_SCHEMA_VERSION,
        )
        try:
            await self._control.send(envelope)
        except Exception as exc:
            LOGGER.warning("failed to send heartbeat: %s", exc)
