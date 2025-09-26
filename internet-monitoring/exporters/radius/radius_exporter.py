import logging
import os
import socket
import threading
import time
from typing import Any, Dict, List

import yaml
from prometheus_client import Enum, Gauge, Info, start_http_server
from pyrad import client, dictionary, packet

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("radius_exporter")

CONFIG_PATH = os.getenv("EXPORTER_CONFIG", "/app/config.yml")
DEFAULT_PORT = int(os.getenv("EXPORTER_PORT", "9812"))
DEFAULT_INTERVAL = int(os.getenv("EXPORTER_INTERVAL", "60"))
DEFAULT_TIMEOUT = float(os.getenv("EXPORTER_TIMEOUT", "5"))
NAS_IDENTIFIER = os.getenv("EXPORTER_NAS_IDENTIFIER", "uxi-radius-probe")
CALLING_STATION = os.getenv("EXPORTER_CALLING_STATION", "00:00:00:00:00:00")

SUCCESS_GAUGE = Gauge(
    "radius_probe_success",
    "Result of the most recent RADIUS authentication attempt (1=success, 0=failure)",
    ["name", "address"],
)
DURATION_GAUGE = Gauge(
    "radius_probe_duration_seconds",
    "Duration in seconds of the most recent RADIUS authentication attempt",
    ["name", "address"],
)
ERROR_GAUGE = Gauge(
    "radius_probe_error",
    "1 when the last RADIUS probe ended in error",
    ["name", "address"],
)
STATE_ENUM = Enum(
    "radius_probe_state",
    "State of the RADIUS authenticator probe",
    states=["ok", "error"],
    labelnames=["name", "address"],
)
MESSAGE_INFO = Info(
    "radius_probe_message",
    "Textual description of the most recent RADIUS probe",
    ["name", "address"],
)
LAST_RUN_GAUGE = Gauge(
    "radius_probe_last_run_timestamp_seconds",
    "Timestamp of the last RADIUS probe execution",
    ["name", "address"],
)


def load_config(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        LOGGER.warning("Configuration file %s not found, using defaults", path)
        return {"interval": DEFAULT_INTERVAL, "timeout": DEFAULT_TIMEOUT, "targets": []}

    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    data.setdefault("interval", DEFAULT_INTERVAL)
    data.setdefault("timeout", DEFAULT_TIMEOUT)
    data.setdefault("targets", [])
    return data


class RadiusProbe(threading.Thread):
    def __init__(self, config: Dict[str, Any], radius_dict: dictionary.Dictionary, default_interval: int, default_timeout: float) -> None:
        super().__init__(daemon=True)
        self.config = config
        self.radius_dict = radius_dict
        self.default_interval = max(1, int(config.get("interval", default_interval)))
        self.default_timeout = max(1.0, float(config.get("timeout", default_timeout)))
        self.name = config.get("name", config.get("address", "unknown"))
        self.address = config.get("address", "127.0.0.1:1812")
        self.secret = (config.get("secret") or "").encode("utf-8")
        self.username = config.get("username", "uxi")
        self.password = config.get("password", "uxi-test")
        self.nas_identifier = config.get("nas_identifier", NAS_IDENTIFIER)
        self.calling_station = config.get("calling_station_id", CALLING_STATION)
        host, port = self.address.split(":") if ":" in self.address else (self.address, "1812")
        self.host = host
        self.port = int(port)
        self.interval = int(config.get("interval", self.default_interval))
        self.timeout = float(config.get("timeout", self.default_timeout))
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        LOGGER.info("Starting RADIUS probe for %s (%s)", self.name, self.address)
        while not self._stop_event.is_set():
            self._execute_probe()
            self._stop_event.wait(self.interval)

    def _execute_probe(self) -> None:
        labels = {"name": self.name, "address": self.address}
        start_time = time.perf_counter()
        message = ""
        success = False
        try:
            result_code = self._send_access_request()
            success = result_code == packet.AccessAccept
            if success:
                message = "Access-Accept"
            elif result_code == packet.AccessReject:
                message = "Access-Reject"
            else:
                message = f"Unexpected RADIUS code {result_code}"
        except Exception as exc:  # pylint: disable=broad-except
            message = f"Probe error: {exc}"
            LOGGER.warning("RADIUS probe %s failed: %s", self.name, exc)
        finally:
            duration = time.perf_counter() - start_time
            SUCCESS_GAUGE.labels(**labels).set(1 if success else 0)
            DURATION_GAUGE.labels(**labels).set(duration)
            ERROR_GAUGE.labels(**labels).set(0 if success else 1)
            STATE_ENUM.labels(**labels).state("ok" if success else "error")
            MESSAGE_INFO.labels(**labels).info({"message": message or ("success" if success else "failure")})
            LAST_RUN_GAUGE.labels(**labels).set(time.time())
            LOGGER.debug("RADIUS probe %s completed in %.3fs: %s", self.name, duration, message)

    def _send_access_request(self) -> int:
        radius_client = client.Client(server=self.host, secret=self.secret, dict=self.radius_dict)
        radius_client.timeout = self.timeout
        radius_client.retries = 1
        request = radius_client.CreateAuthPacket(code=packet.AccessRequest, User_Name=self.username)
        request["User-Password"] = request.PwCrypt(self.password)
        request["NAS-Identifier"] = self.nas_identifier
        try:
            request["Calling-Station-Id"] = self.calling_station
        except Exception:  # pragma: no cover - optional attribute
            pass
        request["NAS-IP-Address"] = self._discover_source_ip()
        response = radius_client.SendPacket(request)
        return response.code

    def _discover_source_ip(self) -> str:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            try:
                sock.connect((self.host, self.port))
                return sock.getsockname()[0]
            except OSError:
                return "127.0.0.1"


def main() -> None:
    config = load_config(CONFIG_PATH)
    radius_dict = dictionary.Dictionary("/app/dictionary")
    interval = int(config.get("interval", DEFAULT_INTERVAL))
    timeout = float(config.get("timeout", DEFAULT_TIMEOUT))
    probes: List[RadiusProbe] = []

    for target in config.get("targets", []):
        if not target.get("address") or not target.get("secret"):
            LOGGER.warning("Skipping RADIUS target with missing address or secret: %s", target)
            continue
        probe = RadiusProbe(target, radius_dict, interval, timeout)
        probe.start()
        probes.append(probe)

    start_http_server(DEFAULT_PORT)
    LOGGER.info("RADIUS exporter listening on %s", DEFAULT_PORT)

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        LOGGER.info("Stopping RADIUS exporter")
        for probe in probes:
            probe.stop()


if __name__ == "__main__":
    main()
