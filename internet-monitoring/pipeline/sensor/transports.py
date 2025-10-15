"""Concrete transports for the sensor pipeline."""

from __future__ import annotations

import asyncio
import json
import ssl
import urllib.request
from typing import Dict, Optional

from ..common.messages import ControlEnvelope, DataChunk
from .interfaces import ChunkSender, ControlChannel


class WebsocketControlChannel(ControlChannel):
    def __init__(
        self,
        url: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        ssl_context: Optional[ssl.SSLContext] = None,
        ping_interval: float = 20.0,
        ping_timeout: float = 20.0,
    ) -> None:
        self._url = url
        self._headers = headers or {}
        self._ssl_context = ssl_context
        self._ping_interval = ping_interval
        self._ping_timeout = ping_timeout
        self._conn = None
        self._conn_lock = asyncio.Lock()

    async def _ensure_connection(self):
        async with self._conn_lock:
            if self._conn is not None:
                return
            try:
                import websockets
            except ModuleNotFoundError as exc:  # pragma: no cover - dependency optional
                raise RuntimeError(
                    "websockets package required for WebsocketControlChannel"
                ) from exc
            self._conn = await websockets.connect(
                self._url,
                extra_headers=self._headers,
                ssl=self._ssl_context,
                ping_interval=self._ping_interval,
                ping_timeout=self._ping_timeout,
            )

    async def recv(self) -> ControlEnvelope:
        await self._ensure_connection()
        assert self._conn is not None
        try:
            raw = await self._conn.recv()
        except Exception:
            await self._reset()
            raise
        return ControlEnvelope.from_dict(json.loads(raw))

    async def send(self, envelope: ControlEnvelope) -> None:
        await self._ensure_connection()
        assert self._conn is not None

        payload = json.dumps(envelope.to_dict())
        try:
            await self._conn.send(payload)
        except Exception:
            await self._reset()
            raise

    async def close(self) -> None:
        async with self._conn_lock:
            if self._conn is not None:
                await self._conn.close()
                self._conn = None

    async def _reset(self) -> None:
        async with self._conn_lock:
            if self._conn is not None:
                try:
                    await self._conn.close()
                except Exception:  # pragma: no cover - defensive
                    pass
                self._conn = None


class HttpChunkSender(ChunkSender):
    def __init__(
        self,
        endpoint: str,
        *,
        timeout: float = 10.0,
        headers: Optional[Dict[str, str]] = None,
        ssl_context: Optional[ssl.SSLContext] = None,
    ) -> None:
        self._endpoint = endpoint
        self._timeout = timeout
        self._headers = headers or {"Content-Type": "application/json"}
        self._ssl_context = ssl_context

    async def send_chunk(self, chunk: DataChunk) -> None:
        payload = json.dumps(chunk.to_dict()).encode("utf-8")

        def _send():
            request = urllib.request.Request(
                self._endpoint,
                data=payload,
                headers=self._headers,
                method="POST",
            )
            with urllib.request.urlopen(
                request, timeout=self._timeout, context=self._ssl_context
            ) as resp:
                status = getattr(resp, "status", resp.getcode())
                if status >= 300:
                    raise RuntimeError(f"chunk post failed status={status}")

        await asyncio.to_thread(_send)
