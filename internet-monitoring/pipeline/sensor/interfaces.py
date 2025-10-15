"""Interfaces for sensor networking components."""

from __future__ import annotations

import abc
from typing import Awaitable, Protocol

from ..common.messages import ControlEnvelope, DataChunk


class ControlChannel(Protocol):
    async def recv(self) -> ControlEnvelope:
        ...

    async def send(self, envelope: ControlEnvelope) -> None:
        ...

    async def close(self) -> None:
        ...


class ChunkSender(Protocol):
    async def send_chunk(self, chunk: DataChunk) -> None:
        ...
