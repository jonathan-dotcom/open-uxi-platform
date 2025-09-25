sudo tee /etc/systemd/system/wifi_exporter.service <<'EOF'
[Unit]
Description=Prometheus Wi-Fi exporter
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/wifi_exporter.py
# Jika interface Anda bukan wlan0, tambahkan argumen:
# ExecStart=/usr/bin/python3 /usr/local/bin/wifi_exporter.py wlan1
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Aktifkan & jalankan
sudo systemctl enable --now wifi_exporter
