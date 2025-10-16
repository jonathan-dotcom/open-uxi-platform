"""Minimal HTTP ingest endpoint for sensor chunks."""

from __future__ import annotations

import asyncio
import json
import ssl
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Awaitable, Callable, Mapping, Optional, Sequence

from ..common.auth import constant_time_compare, extract_bearer
from ..common.messages import DataChunk
from .control import ControlManager
from .offsets import OffsetTracker
from .store import ChunkStore, IngestResult

OnSnapshotCallback = Callable[[IngestResult], Awaitable[None] | None]
DashboardProvider = Callable[[], Mapping[str, object]]


class ChunkIngestService:
    def __init__(
        self,
        store: ChunkStore,
        control: ControlManager,
        offsets: OffsetTracker,
        *,
        loop: Optional[asyncio.AbstractEventLoop] = None,
        on_snapshot: Optional[OnSnapshotCallback] = None,
        sensor_tokens: Optional[Mapping[str, str]] = None,
        dashboard_provider: Optional[DashboardProvider] = None,
        allowed_origins: Optional[Sequence[str]] = None,
    ) -> None:
        self._store = store
        self._control = control
        self._offsets = offsets
        self._loop = loop
        self._on_snapshot = on_snapshot
        self._tokens = dict(sensor_tokens or {})
        self._dashboard_provider = dashboard_provider
        self._allowed_origins = list(allowed_origins or [])

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def set_dashboard_provider(self, provider: Optional[DashboardProvider]) -> None:
        self._dashboard_provider = provider

    def dashboard(self) -> Mapping[str, object]:
        if self._dashboard_provider is None:
            raise LookupError("dashboard provider not configured")
        payload = self._dashboard_provider()
        if not isinstance(payload, Mapping):
            raise TypeError("dashboard provider must return a mapping")
        return payload

    def resolve_cors_origin(self, origin: Optional[str]) -> Optional[str]:
        if not self._allowed_origins:
            return None
        if "*" in self._allowed_origins:
            return "*"
        if origin and origin in self._allowed_origins:
            return origin
        return None

    def ingest(self, payload: bytes, headers: dict) -> tuple[int, dict]:
        body = json.loads(payload.decode("utf-8"))
        chunk = DataChunk.from_dict(body)
        self._validate_sensor(headers, chunk.sensor_id)
        result = self._store.ingest(chunk)

        self._offsets.update(chunk.sensor_id, chunk.sequence)
        self._dispatch_ack(
            sensor_id=chunk.sensor_id,
            sequence=chunk.sequence,
            window_id=chunk.attributes.get("window_id", "default"),
        )

        if result.event_complete and result.assembled_payload and self._on_snapshot:
            self._dispatch_snapshot(result)

        return HTTPStatus.OK, {
            "stored": result.stored,
            "duplicate": result.duplicate,
            "sequence": result.sequence,
            "event_id": result.event_id,
            "sensor_id": result.sensor_id,
            "event_complete": result.event_complete,
            "last_committed_sequence": self._offsets.get(chunk.sensor_id),
        }

    def _dispatch_ack(self, *, sensor_id: str, sequence: int, window_id: str) -> None:
        if self._loop is None:
            # Fallback for tests where no loop is registered.
            asyncio.run(
                self._control.send_ack(
                    sensor_id,
                    sequences=[sequence],
                    window_id=window_id,
                )
            )
            return

        asyncio.run_coroutine_threadsafe(
            self._control.send_ack(
                sensor_id,
                sequences=[sequence],
                window_id=window_id,
            ),
            self._loop,
        )

    def _dispatch_snapshot(self, result: IngestResult) -> None:
        if not self._on_snapshot:
            return

        async def _invoke() -> None:
            maybe = self._on_snapshot(result)
            if asyncio.iscoroutine(maybe):
                await maybe

        if self._loop is None:
            asyncio.run(_invoke())
        else:
            asyncio.run_coroutine_threadsafe(_invoke(), self._loop)

    def _validate_sensor(self, headers: Mapping[str, str], sensor_id: str) -> None:
        token = extract_bearer(headers.get("Authorization"))
        expected = self._tokens.get(sensor_id)
        if not constant_time_compare(expected, token):
            raise PermissionError("unauthorized sensor")


def build_handler(service: ChunkIngestService):
    class Handler(BaseHTTPRequestHandler):
        def _write_json(self, status: int, payload: Mapping[str, object]) -> None:
            data = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            origin = service.resolve_cors_origin(self.headers.get("Origin"))
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                if origin != "*":
                    self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):  # noqa: N802
            if self.path != "/v1/ingest/chunk":
                self.send_error(HTTPStatus.NOT_FOUND, "unknown path")
                return
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length)
            try:
                status, response = service.ingest(payload, dict(self.headers))
            except PermissionError as exc:
                self.send_error(HTTPStatus.UNAUTHORIZED, str(exc))
                return
            except Exception as exc:  # pragma: no cover - defensive path
                self.send_error(
                    HTTPStatus.BAD_REQUEST,
                    f"failed to ingest chunk: {exc}",
                )
                return
            self._write_json(status, response)

        def do_GET(self):  # noqa: N802
            if self.path == "/v1/dashboard":
                try:
                    payload = service.dashboard()
                except LookupError:
                    self.send_error(HTTPStatus.NOT_FOUND, "dashboard not enabled")
                    return
                except Exception as exc:  # pragma: no cover - defensive path
                    self.send_error(
                        HTTPStatus.INTERNAL_SERVER_ERROR,
                        f"failed to build dashboard payload: {exc}",
                    )
                    return
                self._write_json(HTTPStatus.OK, payload)
                return
            if self.path in {"/healthz", "/"}:
                self.send_response(HTTPStatus.NO_CONTENT)
                origin = service.resolve_cors_origin(self.headers.get("Origin"))
                if origin:
                    self.send_header("Access-Control-Allow-Origin", origin)
                    if origin != "*":
                        self.send_header("Vary", "Origin")
                self.end_headers()
                return
            self.send_error(HTTPStatus.NOT_FOUND, "unknown path")

        def do_OPTIONS(self):  # noqa: N802
            origin = service.resolve_cors_origin(self.headers.get("Origin"))
            self.send_response(HTTPStatus.NO_CONTENT)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                if origin != "*":
                    self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()

        def log_message(self, fmt, *args):  # noqa: D401 - standard signature
            # Silence default logging; upstream logger should handle messages.
            return

    return Handler


def create_server(
    host: str,
    port: int,
    service: ChunkIngestService,
    *,
    ssl_context: Optional[ssl.SSLContext] = None,
):
    handler = build_handler(service)
    httpd = ThreadingHTTPServer((host, port), handler)
    if ssl_context is not None:
        httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)
    return httpd
