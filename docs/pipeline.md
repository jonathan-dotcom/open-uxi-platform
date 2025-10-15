# Sensor-to-Server Pipeline

This document explains how the upgraded pipeline fits into the Open UXI Platform, which
components ship in this repository, and how to operate them in production.

## 1. Architecture Overview

- **Control Channel** – Each sensor maintains an outbound WebSocket connection to the
  cloud (`server/control.py`). The server issues `ChunkRequest` messages with an offset,
  size window, and flow-control hints. Sensor replies with per-window `ChunkAck` once
  chunks persist in the ingest store.
- **Data Channel** – Sensors POST chunked results to `server/http_ingest.py` (`/v1/ingest/chunk`).
  The handler verifies hashes, writes to the SQLite-backed `ChunkStore`, updates the offset
  tracker, and enqueues a control-plane ack. Responses contain the server’s latest committed
  sequence for transparency.
- **Durable Queue** – `sensor/queue.py` uses SQLite + WAL to persist chunks until the server
  acknowledges them. A retention window (default 72h) prevents unbounded growth.
- **Dispatch + Flow Control** – `sensor/dispatch.py` enforces per-window limits, tags every
  chunk with the current `window_id`, and retries under failure using bounded exponential
  backoff.
- **Snapshot Cache** – `server/snapshot_cache.py` stores the latest fully assembled event per
  sensor for instant dashboards and UI streaming. The cache is fed from the ingest store when
  an event reaches all chunks.
- **Request Scheduling** – `server/scheduler.py` surfaces helpers for dashboards or cron jobs
  to request fresh data since the last committed sequence.

## 2. Schemas and Compatibility

- Protobuf definitions live in `internet-monitoring/pipeline/proto`. The shared schema version
  is tracked in `internet-monitoring/pipeline/version.py`. Bump it and regenerate bindings when
  making wire breaking changes.
- Reference Python representations (`common/messages.py`) serialize to JSON for the included
  HTTP transports. Swap them with generated Protobuf classes once `protoc` is available on the
  build hosts.

## 3. Security Posture

- **Transport** – Terminate TLS on the control WebSocket and ingest HTTP endpoints. Place both
  behind Nginx or Envoy so sensors only negotiate outbound TLS sessions.
- **Identity** – Issue per-sensor client certificates (preferred) or short-lived OAuth tokens.
  Bind the credential to the sensor ID and verify it before calling `ControlManager.register`.
- **Authorization** – Server rejects unexpected sensor IDs, throttles chunk submissions by
  identity, and rate-limits repeated failures. A sensor can only ack its own sequences.
- **Integrity** – Every chunk must pass SHA-256 validation. Completed events are reassembled and
  hashed before the ack is sent, guaranteeing bit-perfect persistence.
- **Credential Rotation** – Maintain a CA for sensor certificates. Ship a new cert via the
  control channel’s `CommandResponse` mechanism or by updating the Ansible secrets bundle, then
  terminate the old cert after a grace period. For tokens, issue new secrets via Vault and
  configure a short TTL (≤24h).

## 4. Observability

Publish the following metrics (examples assume Prometheus formatting):

- `sensor_queue_depth{sensor_id}` – Straight from `DurableQueue.queue_depth()`.
- `sensor_chunk_retry_total{sensor_id}` – Increment in `SensorAgent._send_chunk_with_backoff`.
- `server_ingest_duplicate_total{sensor_id}` – Count of dedup hits in `ChunkStore`.
- `server_ingest_latency_ms{sensor_id}` – Ingest write latency histogram.
- `server_snapshot_age_seconds{sensor_id}` – `time.time() - snapshot.updated_at`.
- `control_channel_connected` – Gauge per sensor reflecting current WebSocket status.

Recommended alerts:

- Queue depth above 500 chunks for 10 minutes.
- Snapshot age older than 5 minutes when dashboards are active.
- More than 5 consecutive chunk retries.
- Clock skew exceeding ±500 ms.
- Sensors missing heartbeats for >2 intervals.

## 5. Deployment

- Enable the agent or server by setting `pipeline_sensor_enable` or `pipeline_server_enable`
  in your inventory/group vars. The defaults live in `config.yml` and can be overridden per
  host.
- The playbook renders configs under `internet-monitoring/pipeline/config/` and TLS material
  under `internet-monitoring/pipeline/tls/`. Those directories are mounted into the new
  containers provided by `docker-compose.sensor.pipeline.yml` (sensor) and the main
  `docker-compose.yml` (cloud).
- Tokens are declared once via `pipeline_server_auth_sensors`; each sensor host reuses the
  same token via `pipeline_sensor_token`. Rotate them by updating the vars and rerunning the
  playbook.
- TLS is off by default. Drop PEMs into the appropriate variables
  (`pipeline_server_*_tls_*_content`, `pipeline_sensor_*_tls_*_content`) and re-run Ansible to
  enable TLS on either side. Sensors support mutual TLS when cert/key content is provided.
- UI consumers subscribe to `ws(s)://<server>:{{ pipeline_server_stream_port }}` and present
  `Authorization: Bearer {{ pipeline_server_stream_token }}` if a stream token is configured.

## 6. Operations Runbook

1. **Bring-up**
   - Start the control server (`control_server`) under systemd or Docker Compose.
   - Launch the ingest HTTP service and configure Nginx/Certbot for TLS.
   - Configure dashboards to call `RequestScheduler.request_sensor` when users open a panel.
2. **Monitoring**
   - Dashboards should read from `SnapshotCache` for instant display, then subscribe to a UI
     WebSocket that streams cache hits on update.
   - Expose `/metrics` endpoints (not shown here) to Prometheus; reuse existing exporters if
     running on the monitoring hosts.
3. **Failure Recovery**
   - Sensor crash: queue preserves chunks; once the agent restarts it will replay from the last
     acked offset.
   - Server crash: `ChunkStore` and `OffsetTracker` state lives on disk; on boot the scheduler
     can request `since_sequence` equal to the stored offset to resume.
   - Network partitions: scheduler periodically re-issues requests. Sensors back off exponentially
     and retain up to the retention TTL; alert when queue depth crosses thresholds.
4. **Testing**
   - Run `pytest internet-monitoring/pipeline/tests` to exercise chunking, queue durability,
     dedupe, ack handling, and a flaky-link simulator.
   - Use the simulator to emulate high packet loss remotely before rolling to production.

## 7. TODO / Integrations

- Wire the control channel into the existing Ansible roles (render service units for the agent
  and control server).
- Replace JSON transports with generated Protobuf messages when toolchains are available.
- Extend `SnapshotCache` to publish Grafana-ready summaries and live streaming to the existing
  dashboard WebSocket.
- Add trace propagation (e.g., OpenTelemetry) once the central collector is online.
