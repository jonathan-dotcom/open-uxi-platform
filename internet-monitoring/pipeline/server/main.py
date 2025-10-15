"""Entrypoint for the pipeline server control and ingest services."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import signal
import ssl
import threading
from pathlib import Path
from typing import Any, Dict

import yaml

from .control import ControlManager, control_server
from .http_ingest import ChunkIngestService, create_server
from .offsets import OffsetTracker
from .scheduler import RequestScheduler
from .snapshot_cache import SnapshotCache
from .store import ChunkStore, IngestResult
from .stream import SnapshotStreamer

LOGGER = logging.getLogger("pipeline.server")


def load_config(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError("server configuration must be a mapping")
    return data


def build_server_ssl(config: Dict[str, Any]) -> ssl.SSLContext | None:
    if not config or not config.get("enabled", False):
        return None
    cert = config.get("cert")
    key = config.get("key")
    if not cert or not key:
        raise ValueError("TLS enabled but cert/key not provided")
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    context.load_cert_chain(certfile=cert, keyfile=key)
    client_ca = config.get("client_ca")
    if client_ca:
        context.load_verify_locations(client_ca)
        context.verify_mode = ssl.CERT_REQUIRED
    return context


async def run_server(config: Dict[str, Any]) -> None:
    store_cfg = config.get("store", {})
    db_path = Path(store_cfg.get("path", "/var/lib/pipeline/server.db"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    retention_seconds = int(store_cfg.get("retention_hours", 72) * 3600)

    store = ChunkStore(db_path, retention_seconds=retention_seconds)
    offsets = OffsetTracker()
    snapshot_cache = SnapshotCache()
    control = ControlManager()

    scheduler_cfg = config.get("scheduler", {})
    scheduler = RequestScheduler(
        control,
        offsets,
        max_chunks=int(scheduler_cfg.get("max_chunks", 32)),
        max_bytes=int(scheduler_cfg.get("max_bytes", 2 * 1024 * 1024)),
        max_in_flight=int(scheduler_cfg.get("max_in_flight", 32)),
    )

    stream_cfg = config.get("stream", {})
    streamer = SnapshotStreamer(snapshot_cache, token=stream_cfg.get("token"))

    sensors = config.get("auth", {}).get("sensors", [])
    sensor_tokens = {entry["id"]: entry["token"] for entry in sensors if entry.get("id") and entry.get("token")}
    if not sensor_tokens:
        LOGGER.warning("No sensor tokens configured; sensors will be rejected")

    loop = asyncio.get_running_loop()

    async def handle_snapshot(result: IngestResult) -> None:
        snapshot = snapshot_cache.update_from_ingest(result)
        if snapshot:
            await streamer.broadcast(snapshot)

    async def handle_heartbeat(sensor_id: str, heartbeat) -> None:
        offsets.update(sensor_id, int(heartbeat.last_committed_sequence))
        if heartbeat.queue_depth > 0:
            await scheduler.request_sensor(sensor_id)

    ingest_cfg = config.get("ingest", {})
    ingest_ssl = build_server_ssl(ingest_cfg.get("tls", {}))
    ingest_service = ChunkIngestService(
        store,
        control,
        offsets,
        loop=loop,
        on_snapshot=handle_snapshot,
        sensor_tokens=sensor_tokens,
    )

    httpd = create_server(
        ingest_cfg.get("bind", "0.0.0.0"),
        int(ingest_cfg.get("port", 8081)),
        ingest_service,
        ssl_context=ingest_ssl,
    )

    http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    http_thread.start()
    LOGGER.info("HTTP ingest listening on %s:%s", ingest_cfg.get("bind", "0.0.0.0"), ingest_cfg.get("port", 8081))

    control_cfg = config.get("control", {})
    control_ssl = build_server_ssl(control_cfg.get("tls", {}))

    control_server_task = await control_server(
        control,
        host=control_cfg.get("bind", "0.0.0.0"),
        port=int(control_cfg.get("port", 8765)),
        ssl_context=control_ssl,
        sensor_tokens=sensor_tokens,
        on_heartbeat=handle_heartbeat,
    )

    stream_ssl = build_server_ssl(stream_cfg.get("tls", {}))
    await streamer.start(
        stream_cfg.get("bind", "0.0.0.0"),
        int(stream_cfg.get("port", 8766)),
        ssl_context=stream_ssl,
    )
    LOGGER.info(
        "Snapshot stream listening on %s:%s",
        stream_cfg.get("bind", "0.0.0.0"),
        stream_cfg.get("port", 8766),
    )

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        await stop_event.wait()
    finally:
        LOGGER.info("shutting down pipeline server")
        control_server_task.close()
        with contextlib.suppress(Exception):
            await control_server_task.wait_closed()
        await streamer.stop()
        httpd.shutdown()
        http_thread.join(timeout=5)
        store.close()


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline server")
    parser.add_argument("--config", required=True, help="Path to server config YAML")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    configure_logging(args.verbose)

    config = load_config(Path(args.config))
    asyncio.run(run_server(config))


if __name__ == "__main__":
    main()
