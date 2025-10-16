from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from internet_monitoring.pipeline.server.dashboard_api import build_dashboard_payload
from internet_monitoring.pipeline.server.snapshot_cache import Snapshot, SnapshotCache


def test_build_dashboard_payload_uses_sample() -> None:
    cache = SnapshotCache()
    sample_path = Path(__file__).resolve().parents[1] / "server" / "sample_dashboard.json"
    payload = build_dashboard_payload(cache, sample_path=sample_path)

    assert payload["kpis"]["globalAvailability"] > 0
    assert payload["journeys"], "expected sample data to include journeys"
    assert payload["sensors"], "expected sample data to include sensors"


def make_snapshot(sensor_id: str, payload: dict[str, object], *, seconds: int) -> Snapshot:
    updated = datetime.fromtimestamp(seconds, tz=timezone.utc)
    return Snapshot(
        sensor_id=sensor_id,
        event_id=f"event-{sensor_id}",
        payload=json.dumps(payload).encode("utf-8"),
        logical_timestamp_ms=int(seconds * 1000),
        updated_at=updated.timestamp(),
    )


def test_build_dashboard_payload_from_snapshots() -> None:
    cache = SnapshotCache()
    base_seconds = 1710460800  # 2024-03-15T00:00:00Z

    cache._snapshots["sensor-ams-01"] = make_snapshot(
        "sensor-ams-01",
        {
            "sensor": {
                "id": "sensor-ams-01",
                "name": "AMS-01",
                "site": "Amsterdam HQ",
                "region": "EMEA",
                "isp": "KPN",
            },
            "availability": 98.4,
            "latency_ms": 55,
            "packet_loss": 0.2,
            "performance": [
                {
                    "timestamp": "2024-03-15T00:00:00Z",
                    "availability": 99.0,
                    "latency_ms": 45,
                    "packet_loss": 0.1,
                },
                {
                    "timestamp": "2024-03-15T01:00:00Z",
                    "availability": 97.0,
                    "latency_ms": 65,
                    "packet_loss": 0.3,
                },
            ],
            "journeys": [
                {
                    "id": "journey-o365",
                    "name": "Office 365",
                    "status": "degraded",
                    "success_rate": 94.0,
                    "response_time_ms": 640,
                    "impacted_sensors": ["sensor-ams-01"],
                }
            ],
            "alerts": [
                {
                    "id": "alert-ams",
                    "severity": "critical",
                    "summary": "Office 365 degraded in EMEA",
                    "detected_at": "2024-03-15T01:05:00Z",
                    "impacted_journeys": ["Office 365"],
                    "acknowledged": False,
                }
            ],
            "ingest_rate": 1500,
            "status": "degraded",
        },
        seconds=base_seconds,
    )

    cache._snapshots["sensor-sfo-03"] = make_snapshot(
        "sensor-sfo-03",
        {
            "metadata": {
                "name": "SFO-03",
                "site": "San Francisco Edge",
                "region": "Americas",
                "isp": "Comcast",
            },
            "availability": 99.6,
            "latency_ms": 42,
            "performance": [
                {
                    "timestamp": "2024-03-15T00:00:00Z",
                    "availability": 99.5,
                    "latency_ms": 38,
                },
                {
                    "timestamp": "2024-03-15T01:00:00Z",
                    "availability": 99.7,
                    "latency_ms": 40,
                },
            ],
            "journeys": [
                {
                    "id": "journey-zoom",
                    "name": "Zoom",
                    "status": "operational",
                    "success_rate": 99.9,
                    "response_time_ms": 210,
                }
            ],
            "status": "operational",
        },
        seconds=base_seconds + 60,
    )

    payload = build_dashboard_payload(cache)

    assert payload["kpis"]["globalAvailability"] == 99.0
    assert payload["kpis"]["medianLatency"] == 48
    assert payload["kpis"]["activeIncidents"] == 1

    sensors = {sensor["id"]: sensor for sensor in payload["sensors"]}
    assert sensors["sensor-ams-01"]["journeysImpacted"] == 1
    assert sensors["sensor-sfo-03"]["journeysImpacted"] == 0

    journeys = {journey["id"]: journey for journey in payload["journeys"]}
    assert journeys["journey-o365"]["status"] == "degraded"
    assert "sensor-ams-01" in journeys["journey-o365"]["topImpactedSensors"]

    assert payload["alerts"], "expected alert synthesized from snapshot"
    assert payload["alerts"][0]["severity"] == "critical"

    timestamps = [point["timestamp"] for point in payload["timeline"]]
    assert timestamps == sorted(timestamps)
    assert len(timestamps) == 2
