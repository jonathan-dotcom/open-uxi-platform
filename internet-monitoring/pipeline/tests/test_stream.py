import asyncio
import json

from internet_monitoring.pipeline.server.snapshot_cache import SnapshotCache
from internet_monitoring.pipeline.server.stream import SnapshotStreamer


class DummyClient:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def __hash__(self) -> int:  # pragma: no cover - required for set membership
        return id(self)

    async def send(self, message: str) -> None:
        self.messages.append(message)


def test_broadcast_dashboard_persists_and_delivers() -> None:
    async def _run() -> None:
        cache = SnapshotCache()
        streamer = SnapshotStreamer(cache)

        client = DummyClient()
        async with streamer._lock:  # type: ignore[attr-defined]
            streamer._clients.add(client)  # type: ignore[attr-defined]

        payload = {"generatedAt": "now"}
        await streamer.broadcast_dashboard(payload)

        assert streamer.latest_dashboard() == payload
        assert len(client.messages) == 1
        message = json.loads(client.messages[0])
        assert message["type"] == "dashboard"
        assert message["dashboard"] == payload

    asyncio.run(_run())


def test_broadcast_includes_latest_dashboard_on_connect() -> None:
    async def _run() -> None:
        cache = SnapshotCache()
        streamer = SnapshotStreamer(cache)

        # Prime the latest dashboard payload.
        await streamer.broadcast_dashboard({"generatedAt": "primed"})

        client = DummyClient()

        async with streamer._lock:  # type: ignore[attr-defined]
            streamer._clients.add(client)  # type: ignore[attr-defined]

        # Simulate handler sending existing snapshots and the cached dashboard.
        await streamer.broadcast_all()
        await asyncio.sleep(0)
        if streamer._latest_dashboard_message:  # type: ignore[attr-defined]
            await client.send(streamer._latest_dashboard_message)  # type: ignore[attr-defined]

        # The client should have received at least the dashboard message.
        assert any(json.loads(msg).get("type") == "dashboard" for msg in client.messages)

    asyncio.run(_run())
