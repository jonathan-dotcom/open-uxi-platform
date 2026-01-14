# Open UXI Platform - Tutorial Setup Lengkap (Sensor + Cloud)

Repositori ini menyiapkan stack monitoring internet bergaya Aruba UXI: sensor (Raspberry Pi)
menjalankan exporter, dan server cloud (Ubuntu) menjalankan Prometheus + Grafana. Deploy utama
menggunakan Ansible agar instalasi konsisten dan mudah diulang. Panduan ini ditulis untuk
pemula yang baru setup dari nol sekaligus developer yang ingin mengembangkan lebih lanjut.

## Ringkasan

- Sensor mengukur ping, DNS, DHCP, captive portal, SaaS login, fasttest (default), speedtest (opsional), Wi-Fi, dan metrik OS.
- Cloud mengumpulkan metrik dengan Prometheus dan menampilkan dashboard Grafana.
- Opsional: pipeline sensor -> cloud untuk pengiriman data yang tahan gangguan.

## Arsitektur Singkat

```
Internet/Wi-Fi
      |
      v
[Sensor - Raspberry Pi]
  - blackbox exporter (ping/dns/http)
  - fasttest exporter (default) dan speedtest exporter (opsional)
  - node exporter
  - wifi exporter (opsional)
  - prom agent remote write (opsional)
      |
      v
[Cloud - Ubuntu Server]
  - Prometheus
  - Grafana
  - pipeline server (opsional)
```

## Perangkat dan Kebutuhan

### 1) Sensor (Raspberry Pi)
- Raspberry Pi 3/4 (RAM 2 GB minimum, 4 GB direkomendasikan)
- microSD 16 GB minimum (32 GB direkomendasikan)
- Koneksi Wi-Fi atau Ethernet
- Adaptor daya stabil
- OS: Raspberry Pi OS 64-bit atau Ubuntu Server 22.04 (ARM64)

### 2) Cloud (Server Ubuntu)
- Ubuntu Server 20.04 atau 22.04
- CPU 2 core, RAM 4 GB minimum
- Storage 20 GB minimum (lebih besar jika retensi Prometheus lama)
- Akses internet untuk download image Docker

### 3) Mesin Kontrol (Ansible)
- Laptop/PC atau gunakan server cloud
- Python 3.9+ dan Ansible 2.13+
- SSH ke cloud dan sensor

### 4) Jaringan
- Mode rekomendasi (paling mudah): remote write, sensor hanya perlu akses ke cloud pada 9090 (Prometheus receiver)
- Jika memakai scrape langsung, cloud harus bisa mengakses port sensor yang aktif, contoh:
  9115 (blackbox), 9100 (node), 9105 (wifi), 9798 (speedtest jika dipakai), 9801 (fasttest)
- Jika beda lokasi, gunakan VPN atau Tailscale

## Checklist Sebelum Mulai

- Anda sudah menyiapkan IP/hostname untuk cloud dan sensor
- SSH ke kedua host berjalan tanpa prompt password berulang
- Kedua host bisa akses internet
- Anda paham akan memakai LAN langsung atau VPN/Tailscale

## Tutorial Setup dari Nol

### 1) Tentukan Topologi dan Alamat IP

Contoh tabel rencana:

| Peran  | Hostname | IP            | User SSH |
| ------ | -------- | ------------- | -------- |
| Cloud  | uxi-cloud | 203.0.113.10 | ubuntu   |
| Sensor | uxi-pi    | 192.168.1.50 | pi       |

Jika memakai Tailscale, gunakan IP 100.x.y.z pada `ansible_host`.

### 2) Install OS dan Update Paket

**Cloud (Ubuntu Server):**
- Install Ubuntu Server 20.04/22.04
- Buat user dengan sudo
- Update paket:

```bash
sudo apt update
sudo apt -y upgrade
```

**Sensor (Raspberry Pi):**
- Gunakan Raspberry Pi Imager
- Pilih Raspberry Pi OS Lite 64-bit atau Ubuntu Server 22.04
- Aktifkan SSH saat flashing (lebih mudah untuk pemula)
- Update paket setelah boot:

```bash
sudo apt update
sudo apt -y upgrade
```

### 3) Siapkan Akses SSH dari Mesin Kontrol

Di mesin kontrol:

```bash
ssh-keygen -t ed25519 -C "open-uxi"
ssh-copy-id <user>@<cloud-ip>
ssh-copy-id <user>@<sensor-ip>
```

Coba login:

```bash
ssh <user>@<cloud-ip>
ssh <user>@<sensor-ip>
```

### 4) Pastikan Koneksi Jaringan Antar Host

- Mode rekomendasi (remote write): pastikan sensor bisa akses `http://<cloud-ip>:9090/api/v1/write`
- Jika memakai scrape langsung, pastikan cloud dapat mengakses port sensor yang aktif
  (contoh: 9115, 9100, 9105, 9798, 9801)
- Jika berada di jaringan berbeda, pasang VPN/Tailscale pada keduanya
- Jika memakai firewall, pastikan port di atas diizinkan

### 5) Install Docker dan Docker Compose

**Opsi A (disarankan untuk pemula):** Biarkan Ansible meng-install Docker otomatis.
Playbook akan mengunduh `get.docker.com` ketika Docker belum terpasang.

**Opsi B (manual):** Jalankan di cloud dan sensor:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Logout/login ulang agar grup `docker` aktif.

Cek versi:

```bash
docker --version
docker compose version
```

### 6) Siapkan Mesin Kontrol dan Ansible

Di mesin kontrol (bisa di cloud):

```bash
sudo apt install -y git python3 python3-venv python3-pip
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install ansible==2.13.*
```

### 7) Clone Repo dan Install Dependency Ansible

```bash
git clone <repo-url>
cd open-uxi-platform
ansible-galaxy collection install -r requirements.yml
```

### 8) Konfigurasi Inventory

Buat atau edit `inventory.ini`. Contoh:

```ini
[internet_pi:children]
cloud
sensor

[cloud]
uxi-cloud ansible_host=203.0.113.10 ansible_user=ubuntu

[sensor]
uxi-pi ansible_host=192.168.1.50 ansible_user=pi
```

Jika butuh kunci SSH khusus:

```
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

### 9) Konfigurasi Variabel (config.yml dan group_vars)

**A) `config.yml` (global defaults)**
- File ini di-load setelah `example.config.yml` sehingga nilai di `config.yml` akan override.
- Untuk setup baru, aman mulai dari `example.config.yml`:

```bash
cp example.config.yml config.yml
```

Jika repo sudah berisi `config.yml` lama, pertimbangkan membuat file baru seperti
`config.local.yml` dan jalankan playbook dengan `-e @config.local.yml`.

Minimal yang perlu diubah:
- `monitoring_grafana_admin_password` -> ganti password admin Grafana
- `monitoring_ping_hosts` -> daftar URL yang ingin dipantau
- `monitoring_icmp_targets` -> daftar host untuk ping
- `monitoring_speedtest_enable` -> set true jika ingin speedtest
- `config_dir` -> lokasi deploy (default `~`, sehingga path `~/internet-monitoring`)

Catatan speedtest: exporter speedtest tidak ada di compose sensor secara default. Jika
ingin speedtest dari sensor, tambahkan servicenya ke compose sensor atau jalankan
speedtest di cloud dengan `monitoring_include_exporters: true` pada host cloud. Jika
tidak menambah service speedtest, set `monitoring_speedtest_enable: false`.

**B) `group_vars/cloud.yml` (khusus cloud)**
- `monitoring_include_prometheus: true`
- `monitoring_include_grafana: true`
- `monitoring_include_exporters: false`
- `prometheus_remote_write_receiver_enable_cloud`: true jika memakai remote write
- `prometheus_node_exporter_targets_cloud`: daftar target node exporter
- `prometheus_wifi_targets`: daftar target wifi exporter
- `prometheus_speedtest_targets`: daftar target speedtest exporter
- `pipeline_server_enable_host`: aktifkan pipeline server jika dibutuhkan

Catatan: jika `prometheus_speedtest_targets` tidak diisi, Prometheus akan mengambil dari
`speedtest_exporter_target` milik host sensor secara otomatis.

**C) `group_vars/sensor.yml` (khusus sensor)**
- `monitoring_include_exporters: true`
- `wifi_exporter_enable: true` jika ingin metrik Wi-Fi
- `wifi_exporter_iface`: isi nama interface Wi-Fi (cek dengan `ip link` atau `iw dev`)
- `sensor_wifi_networks`: opsional, jika ingin Ansible mengatur Wi-Fi
- `pipeline_sensor_enable_host`: aktifkan pipeline agent jika dibutuhkan
- `prometheus_remote_write_enable_sensor`: true jika memakai remote write ke cloud
- `prometheus_remote_write_url_sensor`: URL receiver Prometheus di cloud

Jika sensor sudah terhubung ke Wi-Fi secara manual, Anda bisa mengosongkan
`sensor_wifi_networks` agar Ansible tidak mengubah konfigurasi Wi-Fi.

**D) Mode rekomendasi (paling mudah): remote write**
1. Di cloud, set `prometheus_remote_write_receiver_enable_cloud: true`.
2. Di sensor, set `prometheus_remote_write_enable_sensor: true`.
3. Di sensor, set `prometheus_remote_write_url_sensor: "http://<cloud-ip>:9090/api/v1/write"`.
4. Anda tidak perlu mengisi target scrape di cloud (`prometheus_node_exporter_targets_cloud`,
   `prometheus_wifi_targets`, `prometheus_speedtest_targets`).

**E) Secrets**
Simpan password, token, atau TLS dalam Ansible Vault jika akan dipakai di produksi.

### 10) Uji Koneksi Ansible

```bash
ansible -i inventory.ini all -m ping
```

Jika ada error SSH, perbaiki `ansible_user`, `ansible_host`, atau kunci SSH.

### 11) Jalankan Playbook

**Cloud dahulu:**

```bash
ansible-playbook -i inventory.ini --limit cloud main.yml
```

**Sensor:**

```bash
ansible-playbook -i inventory.ini --limit sensor main.yml
```

**Sekaligus:**

```bash
ansible-playbook -i inventory.ini main.yml
```

Playbook bisa dijalankan ulang kapan saja untuk update konfigurasi.
Jika sudo meminta password, tambahkan `--ask-become-pass`.

### 12) Verifikasi dan Akses Dashboard

**Cek container di cloud:**

```bash
ssh <user>@<cloud-ip> "cd ~/internet-monitoring && docker compose ps"
```

**Cek exporter di sensor:**

```bash
ssh <user>@<sensor-ip> "curl -f http://localhost:9115/metrics | head"
ssh <user>@<sensor-ip> "curl -f http://localhost:9100/metrics | head"
ssh <user>@<sensor-ip> "curl -f http://localhost:9105/metrics | head"  # jika wifi exporter aktif
ssh <user>@<sensor-ip> "curl -f http://localhost:9798/metrics | head"  # jika speedtest aktif
ssh <user>@<sensor-ip> "curl -f http://localhost:9801/metrics | head"  # jika fasttest aktif
```

**Cek data remote write di cloud (mode rekomendasi):**

```text
up{job="node",sensor="<hostname-di-inventory>"}
```

Jalankan query di `http://<cloud-ip>:9090`. Jika hasilnya `1`, data sensor sudah masuk.
Di mode remote write, halaman `/targets` tidak menampilkan sensor.

**Akses UI:**
- Grafana: `http://<cloud-ip>:3030`
- Prometheus: `http://<cloud-ip>:9090`
- Target status: `http://<cloud-ip>:9090/targets`

Login Grafana:
- user: `admin`
- password: sesuai `monitoring_grafana_admin_password`

## Opsional: Aktifkan Pipeline Sensor -> Cloud

Pipeline berguna jika Anda ingin pengiriman data sensor yang tahan gangguan.

1) Atur token dan URL di `group_vars`:
- `group_vars/cloud.yml`:
  - `pipeline_server_enable_host: true`
  - `pipeline_server_auth_sensors_host`: daftar sensor dan token
- `group_vars/sensor.yml`:
  - `pipeline_sensor_enable_host: true`
  - `pipeline_sensor_token_host`: token yang sama dengan cloud
  - `pipeline_sensor_control_url_host` dan `pipeline_sensor_ingest_url_host`

2) Jalankan playbook ulang untuk cloud dan sensor.

3) Cek log:

```bash
docker logs internet-monitoring-pipeline-server-1 --since 5m
docker logs internet-monitoring-pipeline-agent-1 --since 5m
```

Port pipeline default:
- Control: 8765
- Ingest: 8081
- Stream: 8766

Dokumentasi lengkap pipeline ada di `docs/pipeline.md`.

## Operasional Harian (Ops)

- Update konfigurasi: edit `config.yml` atau `group_vars/*` lalu jalankan playbook ulang.
- Lihat status container (cloud):
  ```bash
  docker compose -f ~/internet-monitoring/docker-compose.yml ps
  ```
- Lihat status container (sensor):
  ```bash
  docker compose -f ~/internet-monitoring/docker-compose.sensor.yml ps
  ```
- Lihat log:
  ```bash
  docker logs -f <container>
  ```

Dokumentasi deployment lanjutan ada di `docs/deployment.md`.

## Manual Docker Workflow (Alternatif)

Stack ini memakai template Ansible untuk menghasilkan `docker-compose.yml` dan konfigurasi
Prometheus/Grafana. Tanpa Ansible, Anda harus merender template tersebut secara manual.
Untuk cara paling mudah dan efektif, gunakan Ansible seperti di tutorial utama.

## Troubleshooting Cepat

- `UNREACHABLE` saat Ansible:
  - cek `inventory.ini`, user, dan SSH key
  - coba `ssh <user>@<host>` manual
- `docker compose: command not found`:
  - pasang `docker-compose-plugin` atau set `docker_install_compose_plugin: true`
- Grafana kosong (remote write):
  - jalankan query `up{job="node",sensor="<hostname-di-inventory>"}` di Prometheus
  - cek log `docker logs -f internet-monitoring-promagent-1` di sensor
- Grafana kosong (scrape langsung):
  - cek `http://<cloud-ip>:9090/targets` pastikan target sensor `UP`
- Wi-Fi exporter tidak muncul:
  - pastikan `wifi_exporter_enable: true`
  - set `wifi_exporter_iface` sesuai interface yang benar

## Panduan Developer

### Struktur Direktori Penting

- `main.yml` - playbook utama
- `tasks/` - langkah instalasi Ansible
- `templates/` - template Jinja2 untuk compose dan config
- `group_vars/` - variabel per grup (cloud dan sensor)
- `internet-monitoring/` - stack Docker dan dashboard Grafana
- `internet_monitoring/` - kode pipeline Python
- `docs/` - dokumentasi lanjutan

### Menambah Exporter Baru

1) Tambahkan definisi service di `templates/docker-compose.yml.j2` atau compose sensor.
2) Tambahkan konfigurasi scrape di `templates/prometheus.yml.j2`.
3) Buat task render config di `tasks/` jika perlu.
4) Tambahkan variabel toggle di `config.yml` atau `group_vars/*`.
5) (Opsional) Tambah dashboard Grafana di `internet-monitoring/grafana/`.

### Testing Pipeline

```bash
pytest internet-monitoring/pipeline/tests
```

## Keamanan (Disarankan)

- Ganti password Grafana sebelum exposure ke publik.
- Simpan token dan password di Ansible Vault.
- Jika akses dari internet, pasang reverse proxy + TLS.

---

Jika Anda baru memulai, fokus ke bagian "Tutorial Setup dari Nol". Setelah sistem berjalan,
lanjutkan ke bagian Operasional atau Panduan Developer sesuai kebutuhan.
