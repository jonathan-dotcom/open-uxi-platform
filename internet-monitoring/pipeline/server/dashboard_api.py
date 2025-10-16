"""Helpers to expose pipeline snapshots as UXI-style dashboard payloads."""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Mapping, MutableMapping, Optional, Sequence

from .snapshot_cache import SnapshotCache

DEFAULT_SAMPLE_PATH = Path(__file__).with_name("sample_dashboard.json")

_STATUS_PRIORITY = {
    "operational": 0,
    "warning": 1,
    "degraded": 1,
    "major": 2,
    "critical": 2,
    "outage": 2,
}

_SEVERITY_MAP = {
    "critical": "critical",
    "major": "critical",
    "high": "critical",
    "warning": "warning",
    "minor": "warning",
    "medium": "warning",
    "info": "info",
    "informational": "info",
}


def _now_iso(now: Optional[datetime] = None) -> str:
    stamp = now or datetime.now(timezone.utc)
    return stamp.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_sample(sample_path: Optional[Path]) -> Dict[str, Any]:
    for candidate in filter(None, (sample_path, DEFAULT_SAMPLE_PATH)):
        candidate = candidate.expanduser()
        if candidate.is_file():
            with candidate.open("r", encoding="utf-8") as handle:
                return json.load(handle)
    # Last resort minimal payload to keep the UI responsive.
    now = _now_iso()
    return {
        "generatedAt": now,
        "reportingWindow": "Live snapshot",
        "kpis": {
            "globalAvailability": 0.0,
            "availabilityChange": 0.0,
            "medianLatency": 0.0,
            "latencyChange": 0.0,
            "activeIncidents": 0,
            "incidentChange": 0.0,
            "ingestRate": 0.0,
            "ingestChange": 0.0,
        },
        "timeline": [],
        "journeys": [],
        "sensors": [],
        "alerts": [],
    }


def _looks_like_dashboard(payload: Mapping[str, Any]) -> bool:
    return all(key in payload for key in ("kpis", "timeline", "sensors", "journeys"))


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_status(value: Any, *, availability: Optional[float] = None) -> str:
    if isinstance(value, str):
        key = value.strip().lower()
        if key in ("ok", "healthy"):
            return "operational"
        if key in ("warn", "warning", "minor"):
            return "degraded"
        if key in ("critical", "major", "down", "outage"):
            return "outage"
        if key in ("degraded", "operational"):
            return key
    if availability is not None:
        if availability >= 99.0:
            return "operational"
        if availability >= 96.0:
            return "degraded"
        return "outage"
    return "operational"


def _status_priority(status: str) -> int:
    return _STATUS_PRIORITY.get(status, 0)


def _normalize_severity(value: Any) -> str:
    if isinstance(value, str):
        mapped = _SEVERITY_MAP.get(value.strip().lower())
        if mapped:
            return mapped
    return "info"


def _timestamp_from(value: Any, *, fallback: datetime) -> str:
    if isinstance(value, (int, float)):
        return _now_iso(datetime.fromtimestamp(float(value), tz=timezone.utc))
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
        return _now_iso(parsed)
    return _now_iso(fallback)


def _extract_metadata(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    for key in ("sensor", "metadata", "identity"):
        value = payload.get(key)
        if isinstance(value, Mapping):
            return value
    return {}


def _normalize_text(value: Any, *, default: str = "") -> str:
    if isinstance(value, str):
        return value
    return default


def _normalize_site(metadata: Mapping[str, Any], payload: Mapping[str, Any]) -> str:
    site = metadata.get("site") or metadata.get("site_name") or payload.get("site")
    if isinstance(site, Mapping):
        return _normalize_text(site.get("name") or site.get("label") or site.get("id"), default="")
    return _normalize_text(site, default="")


def _normalize_region(metadata: Mapping[str, Any], payload: Mapping[str, Any]) -> str:
    region = metadata.get("region") or payload.get("region")
    if isinstance(region, Mapping):
        return _normalize_text(region.get("name") or region.get("label") or region.get("id"), default="")
    return _normalize_text(region, default="")


def _normalize_isp(metadata: Mapping[str, Any], payload: Mapping[str, Any]) -> str:
    isp = metadata.get("isp") or payload.get("isp")
    if isinstance(isp, Mapping):
        return _normalize_text(isp.get("name") or isp.get("label") or isp.get("id"), default="")
    return _normalize_text(isp, default="")


def _extract_performance(
    payload: Mapping[str, Any],
    *,
    fallback_timestamp: datetime,
    fallback_availability: float,
    fallback_latency: float,
) -> List[Mapping[str, Any]]:
    for key in ("performance", "performance_history", "history", "timeseries", "metrics_history"):
        value = payload.get(key)
        if isinstance(value, Sequence):
            points: List[Mapping[str, Any]] = []
            for entry in value:
                if not isinstance(entry, Mapping):
                    continue
                timestamp = _timestamp_from(
                    entry.get("timestamp") or entry.get("time") or entry.get("ts"),
                    fallback=fallback_timestamp,
                )
                availability = _coerce_float(
                    entry.get("availability")
                    or entry.get("success_rate")
                    or entry.get("successRate"),
                    default=fallback_availability,
                )
                latency = _coerce_float(
                    entry.get("latency_ms")
                    or entry.get("latencyMs")
                    or entry.get("response_time")
                    or entry.get("responseTimeMs"),
                    default=fallback_latency,
                )
                jitter = _coerce_float(entry.get("jitter") or entry.get("jitter_ms") or entry.get("jitterMs"), 0.0)
                packet_loss = _coerce_float(
                    entry.get("packet_loss")
                    or entry.get("packetLoss")
                    or entry.get("loss")
                    or entry.get("loss_percent"),
                    0.0,
                )
                points.append(
                    {
                        "timestamp": timestamp,
                        "availability": round(availability, 2),
                        "latencyMs": round(latency),
                        "jitterMs": round(jitter),
                        "packetLoss": round(packet_loss, 2),
                    }
                )
            if points:
                return sorted(points, key=lambda item: item["timestamp"])
    timestamp = _timestamp_from(None, fallback=fallback_timestamp)
    return [
        {
            "timestamp": timestamp,
            "availability": round(fallback_availability, 2),
            "latencyMs": round(fallback_latency),
            "jitterMs": 0,
            "packetLoss": 0.0,
        }
    ]


def _extract_journeys(payload: Mapping[str, Any], sensor_id: str) -> List[Dict[str, Any]]:
    journeys_raw = payload.get("journeys") or payload.get("saas") or payload.get("journey_status")
    journeys: List[Dict[str, Any]] = []
    if isinstance(journeys_raw, Mapping):
        journeys_raw = journeys_raw.values()
    if isinstance(journeys_raw, Sequence):
        for entry in journeys_raw:
            if not isinstance(entry, Mapping):
                continue
            journey_id = _normalize_text(entry.get("id") or entry.get("journey_id") or entry.get("name"), default="")
            if not journey_id:
                continue
            name = _normalize_text(entry.get("name") or entry.get("label") or journey_id, default=journey_id)
            success = _coerce_float(entry.get("success_rate") or entry.get("successRate"), default=100.0)
            response = _coerce_float(
                entry.get("response_time") or entry.get("response_time_ms") or entry.get("responseTimeMs"),
                default=_coerce_float(entry.get("latency_ms"), default=0.0),
            )
            status = _normalize_status(entry.get("status"), availability=success)
            impacted_sites = _coerce_int(entry.get("impacted_sites") or entry.get("sites_impacted"), default=0)
            impacted_sensors = []
            raw_impacted = entry.get("impacted_sensors") or entry.get("top_impacted_sensors")
            if isinstance(raw_impacted, Sequence):
                impacted_sensors = [str(item) for item in raw_impacted if isinstance(item, (str, int))]
            if status != "operational" and sensor_id not in impacted_sensors:
                impacted_sensors.append(sensor_id)
            journeys.append(
                {
                    "id": journey_id,
                    "name": name,
                    "successRate": round(success, 1),
                    "responseTimeMs": round(response),
                    "status": status,
                    "impactedSites": impacted_sites or (1 if status != "operational" else 0),
                    "topImpactedSensors": impacted_sensors,
                }
            )
    return journeys


def _extract_alerts(payload: Mapping[str, Any], sensor_id: str, fallback: datetime) -> List[Dict[str, Any]]:
    alerts_raw = payload.get("alerts") or payload.get("incidents")
    alerts: List[Dict[str, Any]] = []
    if isinstance(alerts_raw, Mapping):
        alerts_raw = alerts_raw.values()
    if isinstance(alerts_raw, Sequence):
        for entry in alerts_raw:
            if not isinstance(entry, Mapping):
                continue
            alert_id = _normalize_text(entry.get("id") or entry.get("alert_id") or entry.get("summary"), default="")
            if not alert_id:
                continue
            detected_at = _timestamp_from(entry.get("detected_at") or entry.get("time"), fallback=fallback)
            impacted = entry.get("impacted_journeys") or entry.get("journeys") or []
            if isinstance(impacted, Mapping):
                impacted = impacted.keys()
            impacted_journeys = [str(item) for item in impacted if isinstance(item, (str, int))]
            alerts.append(
                {
                    "id": alert_id,
                    "severity": _normalize_severity(entry.get("severity") or entry.get("level")),
                    "summary": _normalize_text(entry.get("summary") or entry.get("message"), default=alert_id),
                    "detectedAt": detected_at,
                    "impactedJourneys": impacted_journeys,
                    "affectedSites": _coerce_int(entry.get("affected_sites") or entry.get("sites"), default=0),
                    "acknowledged": bool(entry.get("acknowledged") or entry.get("cleared")),
                }
            )
    # Annotate the sensor id if no journeys were provided and this alert looks local.
    if not alerts and payload.get("status") not in (None, "operational"):
        alerts.append(
            {
                "id": f"alert-{sensor_id}",
                "severity": _normalize_severity(payload.get("status")),
                "summary": f"{sensor_id} reported an issue",
                "detectedAt": _timestamp_from(None, fallback=fallback),
                "impactedJourneys": [],
                "affectedSites": 1,
                "acknowledged": False,
            }
        )
    return alerts


def _extract_ingest_rates(payload: Mapping[str, Any]) -> List[float]:
    values: List[float] = []
    for key in ("ingest_rate", "ingestRate", "ingest_per_minute", "messages_per_minute"):
        value = payload.get(key)
        if isinstance(value, (int, float)):
            values.append(float(value))
    return values


def _build_timeline(performance_sets: List[List[Mapping[str, Any]]]) -> List[Dict[str, Any]]:
    buckets: MutableMapping[str, List[Mapping[str, Any]]] = defaultdict(list)
    for series in performance_sets:
        for point in series:
            if not isinstance(point, Mapping):
                continue
            timestamp = point.get("timestamp")
            if not isinstance(timestamp, str):
                continue
            buckets[timestamp].append(point)
    timeline: List[Dict[str, Any]] = []
    for timestamp in sorted(buckets.keys()):
        points = buckets[timestamp]
        if not points:
            continue
        success_values = [_coerce_float(p.get("availability"), default=0.0) for p in points]
        latency_values = [_coerce_float(p.get("latencyMs"), default=0.0) for p in points]
        timeline.append(
            {
                "timestamp": timestamp,
                "successRate": round(sum(success_values) / len(success_values), 2),
                "latencyMs": round(sum(latency_values) / len(latency_values)),
            }
        )
    return timeline


def _fallback_timeline(now: datetime, sensors: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    base = now.replace(minute=0, second=0, microsecond=0)
    availability = [
        _coerce_float(sensor.get("availability"), default=0.0)
        for sensor in sensors
        if sensor.get("availability") is not None
    ]
    latency = [
        _coerce_float(sensor.get("latencyMs"), default=0.0)
        for sensor in sensors
        if sensor.get("latencyMs") is not None
    ]
    avg_availability = sum(availability) / len(availability) if availability else 0.0
    avg_latency = sum(latency) / len(latency) if latency else 0.0
    return [
        {
            "timestamp": _now_iso(base - (2 - index) * timedelta(hours=1)),
            "successRate": round(avg_availability, 2),
            "latencyMs": round(avg_latency),
        }
        for index in range(3)
    ]


def build_dashboard_payload(cache: SnapshotCache, *, sample_path: Optional[Path] = None) -> Dict[str, Any]:
    snapshots = cache.all()
    now = datetime.now(timezone.utc)
    if not snapshots:
        return _load_sample(sample_path)

    sensors: List[Dict[str, Any]] = []
    performance_sets: List[List[Mapping[str, Any]]] = []
    ingest_rates: List[float] = []
    alerts_by_id: Dict[str, Dict[str, Any]] = {}
    journeys_by_id: Dict[str, Dict[str, Any]] = {}

    for snapshot in snapshots.values():
        payload = snapshot.as_json()
        if isinstance(payload, Mapping) and _looks_like_dashboard(payload):
            return payload  # Sensor already computed a full snapshot payload.
        if not isinstance(payload, Mapping):
            continue

        metadata = _extract_metadata(payload)
        name = _normalize_text(metadata.get("name") or payload.get("name"), default=snapshot.sensor_id)
        site = _normalize_site(metadata, payload)
        region = _normalize_region(metadata, payload)
        isp = _normalize_isp(metadata, payload)

        availability = _coerce_float(
            metadata.get("availability")
            or payload.get("availability")
            or payload.get("availability_percent"),
            default=100.0,
        )
        latency = _coerce_float(
            metadata.get("latency_ms")
            or payload.get("latency_ms")
            or payload.get("latencyMs"),
            default=0.0,
        )
        packet_loss = _coerce_float(
            metadata.get("packet_loss")
            or payload.get("packet_loss")
            or payload.get("packetLoss"),
            default=0.0,
        )

        updated_at = datetime.fromtimestamp(snapshot.updated_at, tz=timezone.utc)
        performance = _extract_performance(
            payload,
            fallback_timestamp=updated_at,
            fallback_availability=availability,
            fallback_latency=latency,
        )
        performance_sets.append(performance)

        journeys = _extract_journeys(payload, snapshot.sensor_id)
        for journey in journeys:
            key = journey["id"]
            existing = journeys_by_id.get(key)
            if existing is None or _status_priority(journey["status"]) > _status_priority(existing["status"]):
                journeys_by_id[key] = journey

        alerts = _extract_alerts(payload, snapshot.sensor_id, updated_at)
        for alert in alerts:
            alerts_by_id.setdefault(alert["id"], alert)

        ingest_rates.extend(_extract_ingest_rates(payload))

        sensors.append(
            {
                "id": snapshot.sensor_id,
                "name": name,
                "site": site or "",
                "region": region or "",
                "isp": isp or "",
                "lastCheck": _timestamp_from(payload.get("last_check"), fallback=updated_at),
                "availability": round(availability, 2),
                "latencyMs": round(latency),
                "packetLoss": round(packet_loss, 2),
                "status": _normalize_status(payload.get("status"), availability=availability),
                "journeysImpacted": 0,
                "performance": performance,
            }
        )

    if not sensors:
        return _load_sample(sample_path)

    journeys = sorted(journeys_by_id.values(), key=lambda entry: _status_priority(entry["status"]), reverse=True)
    for sensor in sensors:
        impacted = sum(1 for journey in journeys if sensor["id"] in (journey.get("topImpactedSensors") or []))
        sensor["journeysImpacted"] = impacted

    timeline = _build_timeline(performance_sets)
    if not timeline:
        timeline = _fallback_timeline(now, sensors)

    availability_values = [sensor["availability"] for sensor in sensors]
    latency_values = [sensor["latencyMs"] for sensor in sensors]

    try:
        global_availability = round(statistics.mean(availability_values), 2)
    except statistics.StatisticsError:
        global_availability = 0.0
    try:
        median_latency = round(statistics.median(latency_values))
    except statistics.StatisticsError:
        median_latency = 0.0

    ingest_rate = round(statistics.mean(ingest_rates), 2) if ingest_rates else float(len(sensors)) * 60.0

    alerts = sorted(alerts_by_id.values(), key=lambda entry: entry["detectedAt"], reverse=True)

    return {
        "generatedAt": _now_iso(now),
        "reportingWindow": f"Live snapshots from {len(sensors)} sensor(s)",
        "kpis": {
            "globalAvailability": global_availability,
            "availabilityChange": 0.0,
            "medianLatency": median_latency,
            "latencyChange": 0.0,
            "activeIncidents": sum(1 for journey in journeys if journey["status"] != "operational"),
            "incidentChange": 0.0,
            "ingestRate": ingest_rate,
            "ingestChange": 0.0,
        },
        "timeline": timeline,
        "journeys": journeys,
        "sensors": sorted(sensors, key=lambda sensor: sensor["name"] or sensor["id"]),
        "alerts": alerts,
    }
