from __future__ import annotations

import gzip
import os

from internet_monitoring.pipeline.common.chunking import (
    DEFAULT_CHUNK_SIZE,
    EventChunk,
    chunk_payload,
    random_event_id,
)


def test_chunking_round_trip():
    data = os.urandom(DEFAULT_CHUNK_SIZE + 1024)
    event_id = random_event_id()
    chunks = chunk_payload(data, event_id, chunk_size=DEFAULT_CHUNK_SIZE)
    assert len(chunks) == 2
    reassembled = b"".join(gzip.decompress(chunk.payload) for chunk in chunks)
    assert reassembled == data
    # All chunks should share the same event hash.
    event_hashes = {chunk.event_hash for chunk in chunks}
    assert len(event_hashes) == 1
