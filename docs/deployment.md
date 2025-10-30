# Deployment Guide

This guide expands on the quick-start in the repository README and walks through a
full production-style deployment of the split Open UXI Platform stack (cloud
Prometheus/Grafana node + Raspberry Pi sensor exporters).

## 1. Topology Overview

The playbook treats the environment as two Ansible host groups:

- **`cloud`** – Ubuntu (or other Linux) server that runs Prometheus, Grafana, and
  optional pipeline services inside Docker Compose.
- **`sensor`** – Raspberry Pi (64-bit Pi OS, Ubuntu, or Debian) that runs only the
  exporter compose file and optional Wi-Fi systemd exporter.

The control machine can be either of those hosts or any workstation that has SSH
access to both. The defaults assume a single cloud host and one Pi, but you can
add multiple sensors by creating more inventory entries.

## 2. Requirements Checklist

| Component        | Requirements |
| ---------------- | ------------ |
| Control machine  | Python 3.9+, Ansible 2.13+, `community.docker` collection, SSH access to targets. |
| Cloud host       | Docker Engine + Compose V2, 2 CPU cores, 4 GB RAM minimum, outbound HTTPS to download images, storage for Prometheus (~20 GB recommended). |
| Sensor host      | Docker Engine + Compose V2, Wi-Fi interface if using the Wi-Fi exporter, outbound HTTPS. |
| Networking       | SSH from control machine to both hosts, Prometheus access to sensor exporters (typically over Tailnet/VPN), optional HTTPS ingress for Grafana. |

Install Docker/Compose using the official instructions for your distribution. On
Ubuntu, for example:

```bash
sudo apt update
sudo apt install ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out/in after adding your user to the `docker` group so compose commands work
without `sudo`.

## 3. Prepare the Control Machine

1. **Clone the repository** and change into it:
   ```bash
   git clone https://github.com/<your-org>/open-uxi-platform.git
   cd open-uxi-platform
   ```
2. **Install Ansible dependencies**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install ansible
   ansible-galaxy collection install -r requirements.yml
   ```
3. **Configure SSH** so Ansible can connect without interactive prompts:
   - Copy your control machine SSH key to each target (`ssh-copy-id user@host`).
   - Add host aliases to `~/.ssh/config` if the inventory uses names instead of IPs.
   - If using Tailscale, confirm you can reach the Pi’s Tailnet IP (`ssh pi@100.x.y.z`).
4. **Gather host facts** (optional but recommended to verify connectivity):
   ```bash
   ansible -i inventory.ini all -m ping
   ```

## 4. Customize Inventory and Variables

1. **Inventory (`inventory.ini`)** – replace the sample hostnames and users:
   ```ini
   [internet_pi:children]
   cloud
   sensor

   [cloud]
   monitor.example.com ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_ed25519

   [sensor]
   pi-tailnet ansible_host=100.101.102.103 ansible_user=pi
   ```
   Duplicate the `[sensor]` entry for each additional Pi. Include
   `ansible_port=22` or other SSH options as needed.
2. **Global defaults (`config.yml`)** – tune ping targets, DNS servers, optional
   exporters, and Grafana credentials. Copy the file to `config.local.yml` if
   you prefer to keep secrets out of version control, then reference it from the
   command line (`-e @config.local.yml`).
3. **Group variables**:
   - `group_vars/cloud.yml` – verify Prometheus scrape targets, Grafana admin
     password, and optional pipeline server settings.
   - `group_vars/sensor.yml` – set Wi-Fi interface overrides, exporter toggles,
     and pipeline agent tokens (`pipeline_sensor_token_host`).
   - Per-host overrides can go in `host_vars/<hostname>.yml`.
4. **Secrets** – store sensitive values (Grafana passwords, pipeline tokens,
   TLS PEM contents) in an Ansible Vault file and include it via
   `--extra-vars @secrets.yml --ask-vault-pass` when running playbooks.

## 5. Run the Playbook

Execute the playbook once per tier or in a single run.

### 5.1 Cloud Node

```bash
ansible-playbook -i inventory.ini --limit cloud main.yml
```

This renders `internet-monitoring/docker-compose.yml`, copies configuration into
`~/internet-monitoring/`, and starts the stack via `docker compose up -d`.

### 5.2 Sensor Node(s)

```bash
ansible-playbook -i inventory.ini --limit sensor main.yml
```

Each Pi receives `docker-compose.sensor.yml` (plus optional overrides) under
`~/internet-monitoring/` and the exporters start automatically.

### 5.3 Both Tiers Together

After validating SSH access and sudo permissions, run:

```bash
ansible-playbook -i inventory.ini main.yml
```

The playbook handles idempotent updates—rerun the same command whenever you
change configs or upgrade the stack.

## 6. Post-Deployment Validation

- **Docker services**
  ```bash
  ssh jojo@monitor.example.com "cd internet-monitoring && docker compose ps"
  ssh pi@pi-tailnet "cd internet-monitoring && docker compose -f docker-compose.sensor.yml ps"
  ```
- **Prometheus targets** – browse `http://monitor.example.com:9090/targets` (or
  the HTTPS endpoint if fronted by Nginx) and confirm the Pi exporters show as
  `UP`.
- **Grafana** – log in at `https://monitor.example.com/` with the credentials in
  `group_vars/cloud.yml`. Change the admin password immediately.
- **Sensor exporters** – verify metrics locally:
  ```bash
  curl http://localhost:9115/metrics   # speedtest-exporter
  curl http://localhost:9100/metrics   # node exporter
  curl http://localhost:9798/metrics   # wifi exporter (if enabled)
  ```
- **Pipeline services** (if enabled) – check logs:
  ```bash
  docker logs internet-monitoring-pipeline-server-1 --since 5m
  docker logs internet-monitoring-pipeline-agent-1 --since 5m
  ```

## 7. Ongoing Operations

| Task | Command/Notes |
| ---- | ------------- |
| Update images | `ansible-playbook -i inventory.ini main.yml` (playbook pulls new tags when variables change). |
| Restart stack | `docker compose restart <service>` inside `~/internet-monitoring/` on the relevant host. |
| Apply config change | Edit `group_vars`/`config.yml`, commit if using Git, rerun the playbook. |
| Check disk usage | `docker system df` and `du -sh ~/internet-monitoring/prometheus`. |
| Backup Grafana | Persist `/var/lib/grafana` (mounted in compose) or use Grafana provisioning to export dashboards. |

## 8. Troubleshooting

- **Ansible fails with `UNREACHABLE`** – verify SSH connectivity (`ssh user@host`)
  and ensure the user has passwordless sudo (or supply `--ask-become-pass`).
- **Docker permission errors** – add the deploying user to the `docker` group and
  re-login.
- **Prometheus cannot reach the Pi** – confirm overlay network routes (Tailscale,
  WireGuard) and update `prometheus_wifi_targets` / `prometheus_node_exporter_targets`.
- **Grafana does not start** – check `docker compose logs grafana` on the cloud
  host; ensure `GF_SECURITY_ADMIN_PASSWORD` is set in `group_vars/cloud.yml`.
- **Pipeline agent stuck** – inspect `queue.db` growth under
  `/var/lib/pipeline/`. Large queues usually mean the ingest endpoint is
  unreachable; check server logs and firewall rules.

## 10. Next Steps

- Add additional sensors by appending entries to the `[sensor]` group.
- Integrate with external alerting (PagerDuty, Slack) by configuring Grafana
  contact points or Prometheus Alertmanager.
- Use the provided dashboards under `internet-monitoring/grafana/provisioning` as
  templates for custom visualizations.

Refer back to `docs/pipeline.md` for deeper coverage of the pipeline services
when enabling sensor-to-cloud streaming.
