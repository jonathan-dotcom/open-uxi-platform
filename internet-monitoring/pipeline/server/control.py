"""Server-side control channel manager."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict, Iterable, Mapping, Optional

from ..common.auth import constant_time_compare, extract_bearer
from ..common.messages import ChunkAck, ChunkRequest, ControlEnvelope, Heartbeat
from ..version import PIPELINE_SCHEMA_VERSION

LOGGER = logging.getLogger(__name__)


@dataclass
class ControlSession:
    sensor_id: str
    websocket: "websockets.WebSocketServerProtocol"

    async def send_envelope(self, envelope: ControlEnvelope) -> None:
        await self.websocket.send(json.dumps(envelope.to_dict()))

    async def send_chunk_request(
        self,
        *,
        since_sequence: int,
        max_chunks: int,
        max_bytes: int,
        window_id: str,
        max_in_flight: int,
    ) -> None:
        request = ChunkRequest(
            since_sequence=since_sequence,
            max_chunks=max_chunks,
            max_bytes=max_bytes,
            window_id=window_id,
            max_in_flight=max_in_flight,
        )
        envelope = ControlEnvelope(
            sensor_id=self.sensor_id,
            body_type="chunk_request",
            body=request,
            schema_version=PIPELINE_SCHEMA_VERSION,
        )
        await self.send_envelope(envelope)

    async def send_ack(
        self, *, sequences: Iterable[int], window_id: str, reset_window: bool = False
    ) -> None:
        ack = ChunkAck(
            window_id=window_id,
            committed_sequences=list(sequences),
            reset_window=reset_window,
        )
        envelope = ControlEnvelope(
            sensor_id=self.sensor_id,
            body_type="chunk_ack",
            body=ack,
            schema_version=PIPELINE_SCHEMA_VERSION,
        )
        await self.send_envelope(envelope)


class ControlManager:
    def __init__(self) -> None:
        self._sessions: Dict[str, ControlSession] = {}
        self._lock = asyncio.Lock()

    async def register(self, session: ControlSession) -> None:
        async with self._lock:
            self._sessions[session.sensor_id] = session
            LOGGER.info("sensor %s connected to control channel", session.sensor_id)

    async def unregister(self, sensor_id: str) -> None:
        async with self._lock:
            self._sessions.pop(sensor_id, None)
            LOGGER.info("sensor %s disconnected", sensor_id)

    async def send_chunk_request(
        self,
        sensor_id: str,
        *,
        since_sequence: int,
        max_chunks: int,
        max_bytes: int,
        window_id: str,
        max_in_flight: int,
    ) -> bool:
        session = await self._get_session(sensor_id)
        if not session:
            return False
        await session.send_chunk_request(
            since_sequence=since_sequence,
            max_chunks=max_chunks,
            max_bytes=max_bytes,
            window_id=window_id,
            max_in_flight=max_in_flight,
        )
        return True

    async def send_ack(
        self,
        sensor_id: str,
        *,
        sequences: Iterable[int],
        window_id: str,
        reset_window: bool = False,
    ) -> bool:
        session = await self._get_session(sensor_id)
        if not session:
            return False
        await session.send_ack(
            sequences=sequences,
            window_id=window_id,
            reset_window=reset_window,
        )
        return True

    async def _get_session(self, sensor_id: str) -> Optional[ControlSession]:
        async with self._lock:
            return self._sessions.get(sensor_id)


async def control_server(
    manager: ControlManager,
    host: str = "0.0.0.0",
    port: int = 8765,
    *,
    ssl_context=None,
    sensor_tokens: Optional[Mapping[str, str]] = None,
    on_heartbeat: Optional[Callable[[str, Heartbeat], Awaitable[None]]] = None,
    on_message: Optional[Callable[[str, ControlEnvelope], Awaitable[None]]] = None,
) -> None:
    try:
        import websockets
    except ModuleNotFoundError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("websockets package is required for control_server") from exc

    tokens = dict(sensor_tokens or {})

    async def _handler(websocket):
        headers = websocket.request_headers
        sensor_id = headers.get("X-Sensor-ID")
        token = extract_bearer(headers.get("Authorization"))
        if not sensor_id:
            LOGGER.warning("control connection missing X-Sensor-ID header")
            await websocket.close(code=1002, reason="missing sensor id")
            return
        expected = tokens.get(sensor_id)
        if expected is None:
            LOGGER.warning("unexpected sensor id %s attempted to connect", sensor_id)
            await websocket.close(code=1008, reason="unauthorized sensor")
            return
        if not constant_time_compare(expected, token):
            LOGGER.warning("invalid token for sensor %s", sensor_id)
            await websocket.close(code=1008, reason="invalid token")
            return

        session = ControlSession(sensor_id=sensor_id, websocket=websocket)
        await manager.register(session)
        try:
            async for message in websocket:
                envelope = ControlEnvelope.from_dict(json.loads(message))
                LOGGER.debug("control message from %s: %s", sensor_id, envelope.body_type)
                if envelope.body_type == "heartbeat" and on_heartbeat:
                    await on_heartbeat(sensor_id, envelope.body)  # type: ignore[arg-type]
                elif on_message:
                    await on_message(sensor_id, envelope)
        except websockets.ConnectionClosed:
            LOGGER.info("control channel closed for %s", sensor_id)
        finally:
            await manager.unregister(sensor_id)

    server = await websockets.serve(_handler, host, port, ssl=ssl_context)
    LOGGER.info("control server listening on %s:%d", host, port)
    return server
