"""WebSocket streamer that broadcasts snapshot updates to UI clients."""

from __future__ import annotations

import asyncio
import base64
import json
from typing import List, Optional, Set

from ..common.auth import constant_time_compare, extract_bearer
from .snapshot_cache import Snapshot, SnapshotCache


class SnapshotStreamer:
    def __init__(self, cache: SnapshotCache, token: str | None = None) -> None:
        self._cache = cache
        self._token = token or ""
        self._clients: Set["websockets.WebSocketServerProtocol"] = set()
        self._lock = asyncio.Lock()
        self._server = None

    async def start(self, host: str, port: int, *, ssl_context=None):
        import websockets

        self._server = await websockets.serve(
            self._handler,
            host,
            port,
            ssl=ssl_context,
        )
        return self._server

    async def stop(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

    async def broadcast(self, snapshot: Snapshot) -> None:
        message = json.dumps({
            "type": "snapshot",
            "snapshot": self._serialize_snapshot(snapshot),
        })
        await self._publish(message)

    async def broadcast_all(self) -> None:
        snapshots = self._cache.all().values()
        payload = json.dumps(
            {
                "type": "snapshot_batch",
                "snapshots": [self._serialize_snapshot(s) for s in snapshots],
            }
        )
        await self._publish(payload)

    async def _handler(self, websocket, path):
        if self._token:
            token = extract_bearer(websocket.request_headers.get("Authorization"))
            if not constant_time_compare(self._token, token):
                await websocket.close(code=1008, reason="unauthorized")
                return
        async with self._lock:
            self._clients.add(websocket)
        try:
            await self.broadcast_all()
            async for _ in websocket:
                continue
        finally:
            async with self._lock:
                self._clients.discard(websocket)

    async def _publish(self, message: str) -> None:
        async with self._lock:
            if not self._clients:
                return
            dead: List["websockets.WebSocketServerProtocol"] = []
            for client in self._clients:
                try:
                    await client.send(message)
                except Exception:
                    dead.append(client)
            for client in dead:
                self._clients.discard(client)

    @staticmethod
    def _serialize_snapshot(snapshot: Snapshot) -> dict:
        return {
            "sensor_id": snapshot.sensor_id,
            "event_id": snapshot.event_id,
            "logical_timestamp_ms": snapshot.logical_timestamp_ms,
            "updated_at": snapshot.updated_at,
            "payload_base64": base64.b64encode(snapshot.payload).decode("ascii"),
            "payload_json": snapshot.as_json(),
        }
