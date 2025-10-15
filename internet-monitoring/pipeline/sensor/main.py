"""Entrypoint for the sensor pipeline agent."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import signal
import ssl
from pathlib import Path
from typing import Any, Dict

import yaml
from .agent import SensorAgent
from .dispatch import ChunkDispatcher
from .queue import DurableQueue
from .time_sync import ClockSkewEstimator
from .transports import HttpChunkSender, WebsocketControlChannel

LOGGER = logging.getLogger("pipeline.sensor")


def load_config(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError("configuration must be a mapping")
    return data


def build_client_ssl(config: Dict[str, Any]) -> ssl.SSLContext | None:
    tls_cfg = config.get("tls", {})
    if not tls_cfg or not tls_cfg.get("enabled", False):
        return None
    cafile = tls_cfg.get("ca_cert")
    context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=cafile)
    if tls_cfg.get("skip_verify"):
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    cert = tls_cfg.get("cert")
    key = tls_cfg.get("key")
    if cert:
        context.load_cert_chain(certfile=cert, keyfile=key)
    return context


async def run_agent(config: Dict[str, Any]) -> None:
    sensor_id = config["sensor_id"]
    queue_cfg = config.get("queue", {})
    queue_path = Path(queue_cfg.get("path", "/var/lib/pipeline/queue.db"))
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    retention_seconds = int(queue_cfg.get("retention_hours", 72) * 3600)

    queue = DurableQueue(queue_path, retention_seconds=retention_seconds)
    dispatcher = ChunkDispatcher(sensor_id, queue)

    control_cfg = config["control"]
    ingest_cfg = config["ingest"]

    token = config.get("token") or control_cfg.get("token")

    control_headers = dict(control_cfg.get("headers", {}))
    control_headers.setdefault("X-Sensor-ID", sensor_id)
    if token:
        control_headers.setdefault("Authorization", f"Bearer {token}")

    ingest_headers = dict(ingest_cfg.get("headers", {}))
    if token:
        ingest_headers.setdefault("Authorization", f"Bearer {token}")
    ingest_headers.setdefault("Content-Type", "application/json")

    control_ssl = build_client_ssl(control_cfg)
    ingest_ssl = build_client_ssl(ingest_cfg)

    control_channel = WebsocketControlChannel(
        control_cfg["url"],
        headers=control_headers,
        ssl_context=control_ssl,
        ping_interval=float(control_cfg.get("ping_interval", 20.0)),
        ping_timeout=float(control_cfg.get("ping_timeout", 20.0)),
    )

    chunk_sender = HttpChunkSender(
        ingest_cfg["url"],
        timeout=float(ingest_cfg.get("timeout", 10.0)),
        headers=ingest_headers,
        ssl_context=ingest_ssl,
    )

    heartbeat_interval = float(config.get("heartbeat_interval", 30.0))
    capabilities = list(config.get("capabilities", ["chunks", "heartbeats"]))

    time_sync_cfg = config.get("time_sync", {})
    clock_skew = ClockSkewEstimator(
        enabled=bool(time_sync_cfg.get("enabled", False)),
        ntp_server=time_sync_cfg.get("ntp_server", "pool.ntp.org"),
        fallback_skew_ms=float(time_sync_cfg.get("fallback_skew_ms", 0.0)),
    )

    agent = SensorAgent(
        sensor_id,
        dispatcher=dispatcher,
        control_channel=control_channel,
        chunk_sender=chunk_sender,
        queue=queue,
        software_version=config.get("software_version", "unknown"),
        heartbeat_interval=heartbeat_interval,
        capabilities=capabilities,
        clock_skew=clock_skew,
    )

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    agent_task = asyncio.create_task(agent.run())
    try:
        await stop_event.wait()
    finally:
        await agent.shutdown()
        agent_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await agent_task
        queue.close()


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Sensor pipeline agent")
    parser.add_argument("--config", required=True, help="Path to sensor config YAML")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    configure_logging(args.verbose)

    config = load_config(Path(args.config))

    asyncio.run(run_agent(config))


if __name__ == "__main__":
    main()
