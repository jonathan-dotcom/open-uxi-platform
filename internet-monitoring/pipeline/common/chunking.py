"""Chunking and hashing helpers for the sensor pipeline."""

from __future__ import annotations

import gzip
import math
import os
import time
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Dict, Iterable, List


DEFAULT_CHUNK_SIZE = 128 * 1024  # 128 KiB
MIN_CHUNK_SIZE = 64 * 1024
MAX_CHUNK_SIZE = 256 * 1024


@dataclass(frozen=True)
class EventChunk:
    """Representation of a chunk before it receives a persistent sequence number."""

    event_id: str
    chunk_index: int
    chunk_count: int
    compression: str
    payload: bytes
    chunk_hash: bytes
    event_hash: bytes
    logical_timestamp_ms: int
    clock_skew_ms: float
    attributes: Dict[str, str] = field(default_factory=dict)


def _validate_chunk_size(chunk_size: int) -> int:
    if chunk_size < MIN_CHUNK_SIZE or chunk_size > MAX_CHUNK_SIZE:
        raise ValueError(
            f"chunk_size={chunk_size} out of supported range "
            f"[{MIN_CHUNK_SIZE}, {MAX_CHUNK_SIZE}]"
        )
    return chunk_size


def chunk_payload(
    payload: bytes,
    event_id: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    compression: str = "gzip",
    logical_timestamp_ms: int | None = None,
    clock_skew_ms: float = 0.0,
    attributes: Dict[str, str] | None = None,
) -> List[EventChunk]:
    """
    Split payload into compressed chunks with hashing metadata.

    Args:
        payload: Raw measurement bytes gathered on the sensor.
        event_id: Stable identifier for the measurement batch.
        chunk_size: Max uncompressed bytes per chunk.
        compression: Currently only "gzip" is supported.
        logical_timestamp_ms: Event time reported by the sensor.
        clock_skew_ms: Estimated sensor clock skew versus server.
        attributes: Optional metadata sent alongside each chunk.
    """

    chunk_size = _validate_chunk_size(chunk_size)
    if compression != "gzip":
        raise ValueError(f"Unsupported compression codec {compression}")

    if logical_timestamp_ms is None:
        logical_timestamp_ms = int(time.time() * 1000)

    payload_len = len(payload)
    event_hash = sha256(payload).digest()
    chunk_total = max(1, math.ceil(payload_len / chunk_size))
    attributes = dict(attributes or {})

    chunks: List[EventChunk] = []
    for index in range(chunk_total):
        start = index * chunk_size
        end = min(start + chunk_size, payload_len)
        slice_bytes = payload[start:end]
        if not slice_bytes:
            break

        if compression == "gzip":
            compressed = gzip.compress(slice_bytes)
        else:
            compressed = slice_bytes

        chunk_hash = sha256(compressed).digest()
        chunks.append(
            EventChunk(
                event_id=event_id,
                chunk_index=index,
                chunk_count=chunk_total,
                compression=compression,
                payload=compressed,
                chunk_hash=chunk_hash,
                event_hash=event_hash,
                logical_timestamp_ms=logical_timestamp_ms,
                clock_skew_ms=clock_skew_ms,
                attributes=attributes,
            )
        )

    return chunks


def random_event_id() -> str:
    # 16 bytes -> 32 hex chars; stable enough for dedupe and debugging.
    return os.urandom(16).hex()


def chunk_payload_from_iter(
    payloads: Iterable[bytes],
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    compression: str = "gzip",
    clock_skew_ms: float = 0.0,
    attributes: Dict[str, str] | None = None,
) -> List[EventChunk]:
    """
    Utility for chunking concatenated payload streams with a single event id.
    """

    event_id = random_event_id()
    combined = b"".join(payloads)
    return chunk_payload(
        combined,
        event_id,
        chunk_size=chunk_size,
        compression=compression,
        clock_skew_ms=clock_skew_ms,
        attributes=attributes,
    )
