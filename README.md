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
  and Pi-hole on the Pi. It defines `wifi_exporter_target`, which defaults to the host's
  `ansible_host:9105` and is used by the cloud play to build the Wi-Fi exporter scrape job.

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
