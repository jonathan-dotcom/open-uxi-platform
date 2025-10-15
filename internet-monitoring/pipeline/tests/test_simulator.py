from __future__ import annotations

import asyncio
import contextlib
import os
import tempfile

from internet_monitoring.pipeline.common.chunking import chunk_payload, random_event_id
from internet_monitoring.pipeline.common.messages import (
    ChunkAck,
    ChunkRequest,
    ControlEnvelope,
    DataChunk,
)
from internet_monitoring.pipeline.sensor.agent import SensorAgent
from internet_monitoring.pipeline.sensor.dispatch import ChunkDispatcher
from internet_monitoring.pipeline.sensor.queue import DurableQueue


class FakeControlChannel:
    def __init__(self):
        self.incoming: asyncio.Queue[ControlEnvelope] = asyncio.Queue()
        self.sent: list[ControlEnvelope] = []

    async def recv(self) -> ControlEnvelope:
        return await self.incoming.get()

    async def send(self, envelope: ControlEnvelope) -> None:
        self.sent.append(envelope)

    async def close(self) -> None:
        return

    def push(self, envelope: ControlEnvelope) -> None:
        self.incoming.put_nowait(envelope)


class FlakyChunkSender:
    def __init__(self, fail_attempts: int = 1):
        self.fail_attempts = fail_attempts
        self.sent: list[DataChunk] = []
        self._event = asyncio.Event()

    async def send_chunk(self, chunk: DataChunk) -> None:
        if self.fail_attempts > 0:
            self.fail_attempts -= 1
            raise RuntimeError("simulated network failure")
        self.sent.append(chunk)
        self._event.set()

    async def wait_for_chunk(self, timeout: float = 1.0) -> DataChunk:
        await asyncio.wait_for(self._event.wait(), timeout=timeout)
        return self.sent[-1]


async def _run_simulation():
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    queue = DurableQueue(tmp.name)
    try:
        payload = os.urandom(120_000)
        queue.enqueue(chunk_payload(payload, random_event_id()))
        dispatcher = ChunkDispatcher("sensor-sim", queue)
        control = FakeControlChannel()
        sender = FlakyChunkSender(fail_attempts=1)
        agent = SensorAgent(
            "sensor-sim",
            dispatcher=dispatcher,
            control_channel=control,
            chunk_sender=sender,
            queue=queue,
            software_version="test",
            heartbeat_interval=0.05,
        )
        task = asyncio.create_task(agent.run())

        request = ChunkRequest(
            since_sequence=0,
            max_chunks=4,
            max_bytes=512_000,
            window_id="win-1",
            max_in_flight=4,
        )
        control.push(
            ControlEnvelope(
                sensor_id="sensor-sim",
                body_type="chunk_request",
                body=request,
            )
        )

        chunk = await sender.wait_for_chunk()
        ack = ChunkAck(window_id="win-1", committed_sequences=[chunk.sequence], reset_window=False)
        control.push(
            ControlEnvelope(
                sensor_id="sensor-sim",
                body_type="chunk_ack",
                body=ack,
            )
        )
        await asyncio.sleep(0.1)
        assert queue.queue_depth() == 0
    finally:
        await agent.shutdown()
        await asyncio.sleep(0.05)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        queue.close()


def test_simulated_flaky_link_retries_and_acknowledges():
    asyncio.run(_run_simulation())
