import logging
import os
import threading
import time
from typing import Any, Dict, List

import requests
import yaml
from prometheus_client import Enum, Gauge, Info, start_http_server
from requests.auth import HTTPBasicAuth

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("vpn_exporter")

CONFIG_PATH = os.getenv("EXPORTER_CONFIG", "/app/config.yml")
DEFAULT_PORT = int(os.getenv("EXPORTER_PORT", "9310"))
DEFAULT_INTERVAL = int(os.getenv("EXPORTER_INTERVAL", "60"))
DEFAULT_TIMEOUT = float(os.getenv("EXPORTER_TIMEOUT", "5"))

SUCCESS_GAUGE = Gauge(
    "vpn_probe_success",
    "Result of the most recent VPN health probe (1=success)",
    ["name", "uri"],
)
DURATION_GAUGE = Gauge(
    "vpn_probe_duration_seconds",
    "HTTP round trip time for the VPN management endpoint",
    ["name", "uri"],
)
STATUS_CODE_GAUGE = Gauge(
    "vpn_probe_status_code",
    "HTTP status code from the management endpoint",
    ["name", "uri"],
)
STATE_ENUM = Enum(
    "vpn_probe_state",
    "State of the VPN probe",
    states=["ok", "degraded", "error"],
    labelnames=["name", "uri"],
)
MESSAGE_INFO = Info(
    "vpn_probe_message",
    "Human readable result for the latest VPN probe",
    ["name", "uri"],
)
LAST_RUN_GAUGE = Gauge(
    "vpn_probe_last_run_timestamp_seconds",
    "Timestamp of the last VPN probe execution",
    ["name", "uri"],
)


def load_config(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        LOGGER.warning("Configuration file %s not found", path)
        return {"interval": DEFAULT_INTERVAL, "timeout": DEFAULT_TIMEOUT, "targets": []}

    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    data.setdefault("interval", DEFAULT_INTERVAL)
    data.setdefault("timeout", DEFAULT_TIMEOUT)
    data.setdefault("targets", [])
    return data


class VpnProbe(threading.Thread):
    def __init__(self, config: Dict[str, Any], default_interval: int, default_timeout: float) -> None:
        super().__init__(daemon=True)
        self.config = config
        self.name = config.get("name", config.get("management_uri", "vpn"))
        self.uri = config.get("management_uri", "http://localhost")
        self.interval = int(config.get("interval", default_interval))
        self.timeout = float(config.get("timeout", default_timeout))
        self.verify_ssl = bool(config.get("verify_ssl", False if self.uri.startswith("https://") else True))
        self.expected_status = int(config.get("expected_status", 200))
        self.username = config.get("scrape_user")
        self.password = config.get("scrape_password")
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        LOGGER.info("Starting VPN probe for %s (%s)", self.name, self.uri)
        while not self._stop_event.is_set():
            self._execute_probe()
            self._stop_event.wait(self.interval)

    def _execute_probe(self) -> None:
        labels = {"name": self.name, "uri": self.uri}
        start_time = time.perf_counter()
        success = False
        message = ""
        status_code = 0
        try:
            response = self._perform_request()
            status_code = response.status_code
            success = status_code == self.expected_status
            if success:
                state = "ok"
                message = f"HTTP {status_code}"
            else:
                state = "degraded"
                message = f"Unexpected status code {status_code}"
        except Exception as exc:  # pylint: disable=broad-except
            state = "error"
            message = f"Probe error: {exc}"
            LOGGER.warning("VPN probe %s failed: %s", self.name, exc)
        finally:
            duration = time.perf_counter() - start_time
            SUCCESS_GAUGE.labels(**labels).set(1 if success else 0)
            DURATION_GAUGE.labels(**labels).set(duration)
            STATUS_CODE_GAUGE.labels(**labels).set(status_code)
            STATE_ENUM.labels(**labels).state(state)
            MESSAGE_INFO.labels(**labels).info({"message": message or ("success" if success else "failure")})
            LAST_RUN_GAUGE.labels(**labels).set(time.time())
            LOGGER.debug("VPN probe %s completed in %.3fs: %s", self.name, duration, message)

    def _perform_request(self) -> requests.Response:
        auth = HTTPBasicAuth(self.username, self.password) if self.username and self.password else None
        return requests.get(
            self.uri,
            timeout=self.timeout,
            auth=auth,
            verify=self.verify_ssl,
        )


def main() -> None:
    config = load_config(CONFIG_PATH)
    interval = int(config.get("interval", DEFAULT_INTERVAL))
    timeout = float(config.get("timeout", DEFAULT_TIMEOUT))
    probes: List[VpnProbe] = []

    for target in config.get("targets", []):
        if not target.get("management_uri"):
            LOGGER.warning("Skipping VPN target without management_uri: %s", target)
            continue
        probe = VpnProbe(target, interval, timeout)
        probe.start()
        probes.append(probe)

    start_http_server(DEFAULT_PORT)
    LOGGER.info("VPN exporter listening on %s", DEFAULT_PORT)

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        LOGGER.info("Stopping VPN exporter")
        for probe in probes:
            probe.stop()


if __name__ == "__main__":
    main()
