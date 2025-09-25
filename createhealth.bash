sudo tee /usr/local/bin/wifi_exporter.py <<'PY'
#!/usr/bin/env python3
"""
wifi_exporter.py
• Mengekspor RSSI (dBm) dan TX-bitrate (Mb/s) ke Prometheus.
• Interface otomatis terdeteksi, bisa dipaksa via argumen atau env WIFI_IFACE.
"""
import subprocess, re, time, os, sys
from prometheus_client import Gauge, start_http_server
 
# --- Pilih interface ---
iface = os.getenv("WIFI_IFACE") or (sys.argv[1] if len(sys.argv) > 1 else None)
if not iface:
    txt = subprocess.check_output(["iw", "dev"]).decode()
    m = re.search(r"Interface\s+(\w+)", txt)
    if not m:
        raise SystemExit("Tidak ada interface Wi-Fi terdeteksi")
    iface = m.group(1)
 
# --- Definisi metrik ---
RSSI = Gauge("wifi_signal_dbm",  "Wi-Fi signal (dBm)")
TX   = Gauge("wifi_tx_rate_mbps","Wi-Fi TX bitrate (Mb/s)")
 
sig_re = re.compile(r"signal(?:\s+avg)?:\s*(-?\d+(?:\.\d+)?)\s*dBm", re.I)
tx_re  = re.compile(r"tx\s+bitrate:\s*([\d.]+)", re.I)
 
# --- Mulai web server Prometheus ---
start_http_server(9105)
 
while True:
    out = subprocess.check_output(["iw", "dev", iface, "link"]).decode()
    if "Not connected." in out:
        RSSI.set(0)
        TX.set(0)
    else:
        if m := sig_re.search(out):
            RSSI.set(float(m.group(1)))
        if m := tx_re.search(out):
            TX.set(float(m.group(1)))
    time.sleep(15)
PY
