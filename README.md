# Open UXI Platform: Split Sensor + Cloud Deployment

This repository packages the Aruba UXI-inspired internet monitoring stack so you can run
exporters on a Raspberry Pi sensor while Prometheus and Grafana live on a central Ubuntu
server. Follow the steps below to bring both pieces online with Ansible.

## 1. Prerequisites

- Control machine with Ansible 2.13+ and `community.docker` collection
  (`ansible-galaxy collection install -r requirements.yml`). You can run from the Ubuntu
  server itself or any host that can SSH into both targets.
- Docker and Docker Compose v2 installed on the Ubuntu server and the Raspberry Pi.
- SSH access:
  - Ubuntu server (cloud node) user with sudo (default inventory assumes `jojo`).
  - Raspberry Pi user with sudo (example uses `pi`).
- (Optional but recommended) Tailscale or another overlay network so the cloud Prometheus
  can scrape the Pi exporters securely.

## 2. Configure Inventory

Edit `inventory.ini` so it references your hosts:

```ini
[internet_pi:children]
cloud
sensor

[cloud]
cloud-hostname-or-ip ansible_user=jojo

[sensor]
pi ansible_host=100.123.214.125 ansible_user=pi
```

Replace the hostnames/IP addresses and users with values that work in your environment.

## 3. Customize Variables

Group-specific settings live under `group_vars/`:

- `group_vars/cloud.yml` keeps Prometheus and Grafana enabled and disables on-box exporters.
  Populate `prometheus_node_exporter_targets` if you want Prometheus to scrape additional
  node exporters, and override `prometheus_wifi_targets` if the auto-detected sensor address
  list (built from the `wifi_exporter_target` variable on each sensor host) needs adjustment.
- `group_vars/sensor.yml` runs only the exporter compose file and disables Prometheus/Grafana
  and Pi-hole on the Pi. It also enables the Wi-Fi systemd exporter (`wifi_exporter_enable`),
  which auto-detects the radio interface and serves metrics on `wifi_exporter_port` (defaults
  to 9105). Override `wifi_exporter_iface` if your wireless interface is not auto-detected;
  the cloud play uses `wifi_exporter_target` and `speedtest_exporter_target` to populate the
  Wi-Fi and speedtest scrape jobs automatically.

Global defaults remain in `config.yml`; adjust ping hosts, DNS checks, or exporter settings as
needed. Optional exporters (RADIUS, VPN, VoIP) are still controlled through the boolean flags
in `config.yml`.

## 4. Run the Playbook

Install the required collection once:

```bash
ansible-galaxy collection install -r requirements.yml
```

Then provision each tier.

### Cloud Node (Ubuntu server)

```bash
ansible-playbook -i inventory.ini --limit cloud main.yml
```

This copies the monitoring stack to `~/internet-monitoring/`, renders the cloud-friendly
`docker-compose.yml`, and launches Prometheus + Grafana.

### Sensor Node (Raspberry Pi)

```bash
ansible-playbook -i inventory.ini --limit sensor main.yml
```

The playbook syncs the exporter configs, writes `docker-compose.sensor.yml` (and the optional
override when needed), and starts the exporters with Docker Compose.

### One-shot Run for Both Nodes

After credentials and host keys are in place you can configure both tiers in a single pass:

```bash
ansible-playbook -i inventory.ini main.yml
```

## 5. Post-Deployment Checks

1. On the Pi, confirm exporters respond: `curl http://localhost:9115/metrics`,
   `curl http://localhost:9798/metrics`, `curl http://localhost:9100/metrics`.
2. On the server, update `prometheus/prometheus.yml` (rendered by the playbook) so the scrape
   targets use the Pi's overlay IP, then run `docker compose restart prometheus` if you change
   anything manually.
3. Browse Grafana via Nginx/HTTPS (or Tailscale) using the credentials configured in
   `grafana/config.monitoring` and rotate the admin password immediately.

## Manual Docker Workflow (Alternative)

If you prefer to skip Ansible:

- **Sensor (Pi)** – pull this repo, run `docker compose -f internet-monitoring/docker-compose.sensor.yml up -d`
  (extend with `-f docker-compose.sensor.optional.yml` for the Aruba-style exporters).
- **Cloud (Ubuntu)** – copy `internet-monitoring/` to `/opt/internet-monitoring-cloud/`, adjust
  `prometheus/prometheus.yml` to scrape the Pi, and run `docker compose up -d` inside that
  directory. Use Nginx + Certbot to expose Grafana securely.

The Ansible playbook automates those manual steps and keeps both nodes reproducible, so lean on
it once you are ready to maintain the deployment through code.

## 6. Sensor Pipeline Quickstart

The split stack now ships a persistent sensor→cloud delivery pipeline alongside the classic
Prometheus/Grafana deployment. Follow these steps after the prerequisite Ansible run.

### 6.1 Configure Pipeline Secrets

- `group_vars/sensor.yml` – set a unique `pipeline_sensor_token_host` and (optionally) override
  the control/ingest URLs if your Tailscale IPs differ.
- `group_vars/cloud.yml` – enable the pipeline server and list the authorized sensors under
  `pipeline_server_auth_sensors_host`. Each entry requires a matching token.
- Optional: populate any of the `pipeline_*_tls_*_content` variables with PEM strings (CA, cert,
  key) to enable TLS/mTLS on the control, ingest, or snapshot endpoints.

### 6.2 Deploy Both Nodes

```bash
ansible-playbook -i inventory.ini --limit cloud main.yml
ansible-playbook -i inventory.ini --limit sensor main.yml
```

The playbooks render:

- Cloud – `internet-monitoring/pipeline/config/server.yml`, build
  `internet-monitoring-pipeline-server-1`, persist state under `/var/lib/pipeline/server.db`,
  and expose ports `8765` (WebSocket control), `8081` (chunk ingest), `8766` (snapshot stream).
- Sensor – `internet-monitoring/pipeline/config/sensor.yml`, build
  `internet-monitoring-pipeline-agent-1`, store the durable queue in `/var/lib/pipeline/queue.db`.
- Grafana automatically provisions a curated **Pipeline Overview** dashboard
  (`internet-monitoring/grafana/provisioning/dashboards/pipeline-overview.json`) summarizing reachability,
  speedtest results, Wi-Fi signal, and recent check failures per sensor.

### 6.3 Verify Connectivity

1. **Control channel** – on the cloud host run
   `docker logs internet-monitoring-pipeline-server-1 --since 30s` and confirm entries such as  
   `sensor dti connected to control channel`.
2. **Ingest** – from the Pi execute:
   ```bash
   docker logs internet-monitoring-pipeline-agent-1 --since 30s
   ```
   After a measurement you should see `Sent chunk sequence …` with no errors.
3. **Snapshot stream** – from any Tailnet machine:
   ```bash
   wscat -H "Authorization: Bearer <stream-token>" ws://<cloud-ip>:8766
   ```
   A `snapshot_batch` payload is returned immediately, followed by `snapshot` updates as new data arrives.

### 6.4 Manual “Real User” Test

To exercise the full pipeline without waiting for exporters:

```bash
ssh dti@<sensor-ip>
docker exec -i internet-monitoring-pipeline-agent-1 python - <<'PY'
import asyncio, time, yaml
from internet_monitoring.pipeline.common.chunking import chunk_payload, random_event_id
from internet_monitoring.pipeline.sensor.queue import DurableQueue
from internet_monitoring.pipeline.sensor.dispatch import ChunkDispatcher
from internet_monitoring.pipeline.sensor.transports import HttpChunkSender
from internet_monitoring.pipeline.common.messages import ChunkRequest

cfg = yaml.safe_load(open("/config/sensor.yml"))
queue = DurableQueue("/var/lib/pipeline/queue.db")
dispatcher = ChunkDispatcher(cfg["sensor_id"], queue)

payload = f"user test run at {time.time()}".encode()
chunks = chunk_payload(payload, random_event_id())
queue.enqueue(chunks)

request = ChunkRequest(
    since_sequence=dispatcher.last_ack_sequence,
    max_chunks=10,
    max_bytes=512*1024,
    window_id="user-test",
    max_in_flight=10,
)

headers = {"Authorization": f"Bearer {cfg['token']}", "Content-Type": "application/json"}
sender = HttpChunkSender(cfg["ingest"]["url"], timeout=float(cfg["ingest"].get("timeout", 10)), headers=headers)

async def send_all():
    for chunk in dispatcher.build_chunks(request):
        await sender.send_chunk(chunk)
        print("sent chunk", chunk.sequence)

asyncio.run(send_all())
queue.close()
PY
```

On the cloud server you should immediately see the ingest event logged and a new row in
`/var/lib/pipeline/server.db`. Dashboards (Grafana / snapshot stream) show the updated payload
instantly.

### 6.5 Observability & Operations

- Pipeline metrics/snapshot docs live in `docs/pipeline.md`.
- Tail logs with `docker logs -f internet-monitoring-pipeline-{agent,server}-1`.
- Run the unit suite locally with `pytest internet-monitoring/pipeline/tests`.

With these steps you can deploy, verify, and operate the full UXI-style monitoring platform plus
the resilient sensor delivery pipeline directly from this repository.

## 7. Operations Cheat Sheet

- **Logs**
  - Cloud: `docker logs -f internet-monitoring-pipeline-server-1`
  - Sensor: `docker logs -f internet-monitoring-pipeline-agent-1`
- **Database inspection**
  - Server events/chunks: `docker exec -it internet-monitoring-pipeline-server-1 sqlite3 /var/lib/pipeline/server.db`
  - Sensor queue: `docker exec -it internet-monitoring-pipeline-agent-1 sqlite3 /var/lib/pipeline/queue.db`
- **Snapshot stream test**
  ```bash
  wscat -H "Authorization: Bearer <stream-token>" ws://<cloud-ip>:8766
  ```
- **Rotate credentials**
  - Update `pipeline_sensor_token_host` / `pipeline_server_auth_sensors_host` in group vars.
  - Optionally update `pipeline_server_stream_token_host`.
  - Rerun the playbooks; old containers pick up new tokens on restart.
- **Run automated checks**
  ```bash
  pytest internet-monitoring/pipeline/tests
  ```
- **Reset queue or store (lab only)**
  ```bash
  docker exec -it internet-monitoring-pipeline-agent-1 sqlite3 /var/lib/pipeline/queue.db 'DELETE FROM chunks; VACUUM;'
  docker exec -it internet-monitoring-pipeline-server-1 sqlite3 /var/lib/pipeline/server.db 'DELETE FROM chunks; DELETE FROM events; VACUUM;'
  ```

For deeper architectural notes, payload format, metrics, and TLS guidance read `docs/pipeline.md`.

## UXI Control Center web dashboard

A React + Vite front-end is available under `dashboard/` to mirror the Aruba UXI experience with richer visualizations than the bundled Grafana dashboards.

### Run locally

```bash
cd dashboard
npm install
npm run dev
```

The dev server starts on http://localhost:5173 and serves a multi-panel overview (KPIs, time-series trends, journeys, active incidents, and a sensor drill-down experience) backed by the bundled snapshot JSON.

### Data sources and integration

- The React app first queries the pipeline server's `/v1/dashboard` endpoint (served from the ingest process on port `8081`). When that API is unreachable it falls back to `/data/dashboard.json`, which is backed by `dashboard/public/data/dashboard.json` during development.
- You can control the dashboard CORS policy and sample fallback via the `dashboard` section in `pipeline-server.yml`. By default any origin is allowed so the Vite dev server can talk to the pipeline instance.
- If the fetch fails, the UI falls back to the curated sample found in `src/data/sampleData.ts` so the layout still renders offline.
- Live updates stream over the pipeline WebSocket (`ws://<cloud-ip>:8766`). The dashboard will automatically connect using `VITE_DASHBOARD_STREAM_URL` when set; otherwise it derives the address from `VITE_DASHBOARD_API_BASE` and defaults the port to `8766` (override with `VITE_DASHBOARD_STREAM_PORT`). Streaming data immediately replaces the last snapshot without requiring a manual refresh.
- Update the JSON payload to reflect your sensors, journeys, and alerts. The schema matches the TypeScript types in `src/types.ts`, making it straightforward to extend with real pipeline fields.
- Trigger a hard refresh (Ctrl+Shift+R) or use the **Refresh data** button in the UI after swapping out the backing API.

### Production build

```bash
npm run build
```

The static assets land in `dashboard/dist/` and can be served behind the same HTTPS endpoint you already publish for Grafana.
