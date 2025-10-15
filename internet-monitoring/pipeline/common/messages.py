"""Wire message representations mirrored from the protobuf schema."""

from __future__ import annotations

import base64
import dataclasses
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, Literal, Optional

from ..version import PIPELINE_SCHEMA_VERSION


def _utcnow_iso() -> str:
    return datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()


def _to_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _from_base64(data: str) -> bytes:
    return base64.b64decode(data.encode("ascii"))


@dataclass
class Heartbeat:
    software_version: str
    last_committed_sequence: int
    queue_depth: int
    clock_skew_ms: float

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Heartbeat":
        return cls(**data)


@dataclass
class ChunkRequest:
    since_sequence: int
    max_chunks: int
    max_bytes: int
    window_id: str
    max_in_flight: int

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ChunkRequest":
        return cls(**data)


@dataclass
class ChunkAck:
    window_id: str
    committed_sequences: Iterable[int]
    reset_window: bool = False

    def to_dict(self) -> dict:
        return {
            "window_id": self.window_id,
            "committed_sequences": list(self.committed_sequences),
            "reset_window": self.reset_window,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChunkAck":
        return cls(
            window_id=data["window_id"],
            committed_sequences=list(data.get("committed_sequences", [])),
            reset_window=bool(data.get("reset_window", False)),
        )


@dataclass
class CommandResponse:
    command_id: str
    success: bool
    message: str

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "CommandResponse":
        return cls(**data)


ControlBody = Literal["heartbeat", "chunk_request", "chunk_ack", "command_response"]


@dataclass
class ControlEnvelope:
    sensor_id: str
    body_type: ControlBody
    body: Heartbeat | ChunkRequest | ChunkAck | CommandResponse
    sent_at: str | None = None
    capabilities: Optional[Iterable[str]] = None
    schema_version: str = PIPELINE_SCHEMA_VERSION

    def to_dict(self) -> dict:
        payload = self.body.to_dict()
        return {
            "schema_version": self.schema_version,
            "sensor_id": self.sensor_id,
            "sent_at": self.sent_at or _utcnow_iso(),
            "capabilities": list(self.capabilities or []),
            "body_type": self.body_type,
            "body": payload,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ControlEnvelope":
        body_type = data["body_type"]
        body_data = data["body"]
        if body_type == "heartbeat":
            body = Heartbeat.from_dict(body_data)
        elif body_type == "chunk_request":
            body = ChunkRequest.from_dict(body_data)
        elif body_type == "chunk_ack":
            body = ChunkAck.from_dict(body_data)
        elif body_type == "command_response":
            body = CommandResponse.from_dict(body_data)
        else:
            raise ValueError(f"Unknown control body_type={body_type}")
        return cls(
            sensor_id=data["sensor_id"],
            body_type=body_type,
            body=body,
            sent_at=data.get("sent_at"),
            capabilities=data.get("capabilities"),
            schema_version=data.get("schema_version", PIPELINE_SCHEMA_VERSION),
        )


@dataclass
class DataChunk:
    sensor_id: str
    event_id: str
    sequence: int
    chunk_index: int
    chunk_count: int
    compression: str
    payload: bytes
    chunk_sha256: bytes
    event_sha256: bytes
    created_at: str
    logical_timestamp_ms: int
    clock_skew_ms: float
    attributes: Dict[str, str]
    schema_version: str = PIPELINE_SCHEMA_VERSION

    def to_dict(self) -> dict:
        return {
            "schema_version": self.schema_version,
            "sensor_id": self.sensor_id,
            "event_id": self.event_id,
            "sequence": self.sequence,
            "chunk_index": self.chunk_index,
            "chunk_count": self.chunk_count,
            "compression": self.compression,
            "payload": _to_base64(self.payload),
            "chunk_sha256": _to_base64(self.chunk_sha256),
            "event_sha256": _to_base64(self.event_sha256),
            "created_at": self.created_at,
            "logical_timestamp_ms": self.logical_timestamp_ms,
            "clock_skew_ms": self.clock_skew_ms,
            "attributes": self.attributes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DataChunk":
        return cls(
            schema_version=data.get("schema_version", PIPELINE_SCHEMA_VERSION),
            sensor_id=data["sensor_id"],
            event_id=data["event_id"],
            sequence=int(data["sequence"]),
            chunk_index=int(data["chunk_index"]),
            chunk_count=int(data["chunk_count"]),
            compression=data["compression"],
            payload=_from_base64(data["payload"]),
            chunk_sha256=_from_base64(data["chunk_sha256"]),
            event_sha256=_from_base64(data["event_sha256"]),
            created_at=data["created_at"],
            logical_timestamp_ms=int(data["logical_timestamp_ms"]),
            clock_skew_ms=float(data["clock_skew_ms"]),
            attributes=dict(data.get("attributes", {})),
        )
