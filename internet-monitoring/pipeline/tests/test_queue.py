from __future__ import annotations

import os
import tempfile
import time

from internet_monitoring.pipeline.common.chunking import chunk_payload, random_event_id
from internet_monitoring.pipeline.sensor.queue import DurableQueue


def make_queue(retention_seconds: int = 3600) -> DurableQueue:
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    return DurableQueue(tmp.name, retention_seconds=retention_seconds)


def test_queue_enqueue_peek_delete():
    queue = make_queue()
    try:
        payload = os.urandom(200_000)
        chunks = chunk_payload(payload, random_event_id())
        queued = queue.enqueue(chunks)
        assert queue.queue_depth() == len(chunks)
        window = queue.peek_window(
            since_sequence=0,
            max_chunks=1,
            max_bytes=150_000,
        )
        assert len(window) == 1
        first = window[0]
        deleted = queue.delete_sequences([first.sequence])
        assert deleted == 1
        assert queue.queue_depth() == len(chunks) - 1
    finally:
        queue.close()


def test_queue_retention_prunes_old_entries():
    queue = make_queue(retention_seconds=0)
    try:
        payload = os.urandom(64_000)
        queue.enqueue(chunk_payload(payload, random_event_id()))
        time.sleep(0.01)
        queue.enqueue(chunk_payload(payload, random_event_id()))
        assert queue.queue_depth() >= 1
        # Enqueue triggers prune
        queue.enqueue(chunk_payload(payload, random_event_id()))
        assert queue.queue_depth() <= 2
    finally:
        queue.close()
