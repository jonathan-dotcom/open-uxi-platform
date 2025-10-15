"""
Sensor-to-server delivery pipeline for Open UXI Platform.

Modules shipped here implement the reference design described in the
architecture docs: durable queueing on the sensor, chunked delivery over a
persistent control channel, and idempotent ingest on the server.
"""

from .version import PIPELINE_SCHEMA_VERSION

__all__ = ["PIPELINE_SCHEMA_VERSION"]
