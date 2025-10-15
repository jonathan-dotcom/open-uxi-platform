from __future__ import annotations

import os
import tempfile
import time

from internet_monitoring.pipeline.common.chunking import chunk_payload, random_event_id
from internet_monitoring.pipeline.common.messages import DataChunk
from internet_monitoring.pipeline.server.snapshot_cache import SnapshotCache
from internet_monitoring.pipeline.server.store import ChunkStore


def build_data_chunks(sensor_id: str, payload: bytes):
    event_id = random_event_id()
    chunks = chunk_payload(payload, event_id)
    data_chunks = []
    for idx, chunk in enumerate(chunks, start=1):
        created_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        data_chunks.append(
            DataChunk(
                sensor_id=sensor_id,
                event_id=event_id,
                sequence=idx,
                chunk_index=chunk.chunk_index,
                chunk_count=chunk.chunk_count,
                compression=chunk.compression,
                payload=chunk.payload,
                chunk_sha256=chunk.chunk_hash,
                event_sha256=chunk.event_hash,
                created_at=created_iso,
                logical_timestamp_ms=chunk.logical_timestamp_ms,
                clock_skew_ms=chunk.clock_skew_ms,
                attributes={},
            )
        )
    return data_chunks


def test_store_ingest_and_deduplicate():
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    store = ChunkStore(tmp.name)
    payload = os.urandom(150_000)
    data_chunks = build_data_chunks("sensor-1", payload)
    first = store.ingest(data_chunks[0])
    assert first.stored is True
    assert first.event_complete is False
    second = store.ingest(data_chunks[0])
    assert second.duplicate is True
    cache = SnapshotCache()
    for chunk in data_chunks[1:]:
        result = store.ingest(chunk)
    assert result.event_complete is True
    assert result.assembled_payload == payload
    snapshot = cache.update_from_ingest(result)
    assert snapshot is not None
    assert snapshot.sensor_id == "sensor-1"
    store.close()
