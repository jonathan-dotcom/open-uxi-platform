from __future__ import annotations

import os
import tempfile

from internet_monitoring.pipeline.common.chunking import chunk_payload, random_event_id
from internet_monitoring.pipeline.common.messages import ChunkAck, ChunkRequest
from internet_monitoring.pipeline.sensor.dispatch import ChunkDispatcher
from internet_monitoring.pipeline.sensor.queue import DurableQueue


def make_queue():
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    return DurableQueue(tmp.name)


def test_dispatch_builds_chunks_and_processes_ack():
    queue = make_queue()
    try:
        payload = os.urandom(100_000)
        queue.enqueue(chunk_payload(payload, random_event_id()))
        dispatcher = ChunkDispatcher("sensor-xyz", queue)
        request = ChunkRequest(
            since_sequence=0,
            max_chunks=5,
            max_bytes=200_000,
            window_id="w1",
            max_in_flight=5,
        )
        chunks = dispatcher.build_chunks(request)
        assert chunks
        assert chunks[0].attributes["window_id"] == "w1"
        sequences = [chunk.sequence for chunk in queue.peek_window(  # type: ignore[attr-defined]
            since_sequence=0, max_chunks=10, max_bytes=500_000
        )]
        ack = ChunkAck(window_id="w1", committed_sequences=sequences, reset_window=False)
        stats = dispatcher.handle_ack(ack)
        assert stats["deleted"] == len(sequences)
        assert queue.queue_depth() == 0
    finally:
        queue.close()
