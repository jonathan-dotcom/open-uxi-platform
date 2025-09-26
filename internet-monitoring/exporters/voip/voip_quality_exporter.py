import logging
import os
import socket
import threading
import time
import uuid
from collections import deque
from typing import Any, Deque, Dict, List, Tuple

import yaml
from prometheus_client import Enum, Gauge, Info, start_http_server

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("voip_quality_exporter")

CONFIG_PATH = os.getenv("EXPORTER_CONFIG", "/app/config.yml")
DEFAULT_PORT = int(os.getenv("EXPORTER_PORT", "9899"))
DEFAULT_INTERVAL = int(os.getenv("EXPORTER_INTERVAL", "30"))
DEFAULT_TIMEOUT = float(os.getenv("EXPORTER_TIMEOUT", "5"))

SUCCESS_GAUGE = Gauge(
    "voip_probe_success",
    "Result of the most recent SIP OPTIONS transaction (1=success)",
    ["name", "registrar"],
)
DURATION_GAUGE = Gauge(
    "voip_probe_duration_seconds",
    "Round-trip time for SIP OPTIONS",
    ["name", "registrar"],
)
JITTER_GAUGE = Gauge(
    "voip_probe_jitter_ms",
    "Inter-probe jitter derived from latency deltas in milliseconds",
    ["name", "registrar"],
)
MOS_GAUGE = Gauge(
    "voip_probe_mos",
    "Mean opinion score estimate computed from latency and jitter",
    ["name", "registrar"],
)
STATE_ENUM = Enum(
    "voip_probe_state",
    "Quality state for the SIP profile",
    states=["excellent", "acceptable", "poor"],
    labelnames=["name", "registrar"],
)
MESSAGE_INFO = Info(
    "voip_probe_message",
    "Result message for the SIP probe",
    ["name", "registrar"],
)
LAST_RUN_GAUGE = Gauge(
    "voip_probe_last_run_timestamp_seconds",
    "Timestamp of the last SIP probe execution",
    ["name", "registrar"],
)


def load_config(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        LOGGER.warning("Configuration file %s not found", path)
        return {"interval": DEFAULT_INTERVAL, "timeout": DEFAULT_TIMEOUT, "profiles": []}

    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    data.setdefault("interval", DEFAULT_INTERVAL)
    data.setdefault("timeout", DEFAULT_TIMEOUT)
    data.setdefault("profiles", [])
    return data


def parse_host_port(target: str) -> Tuple[str, int]:
    if ":" in target:
        host, port = target.rsplit(":", 1)
        return host, int(port)
    return target, 5060


def build_sip_options(host: str) -> str:
    call_id = uuid.uuid4().hex
    branch = uuid.uuid4().hex
    return (
        f"OPTIONS sip:{host} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP uxi-probe;branch=z9hG4bK{branch}\r\n"
        "Max-Forwards: 70\r\n"
        "From: <sip:uxi-probe@example.com>;tag=uxi\r\n"
        f"To: <sip:{host}>\r\n"
        f"Call-ID: {call_id}@uxi\r\n"
        "CSeq: 1 OPTIONS\r\n"
        "Contact: <sip:uxi-probe@example.com>\r\n"
        "Accept: application/sdp\r\n"
        "User-Agent: UXI Synthetic VoIP Probe\r\n"
        "Content-Length: 0\r\n\r\n"
    )


class VoipProbe(threading.Thread):
    def __init__(self, config: Dict[str, Any], default_interval: int, default_timeout: float) -> None:
        super().__init__(daemon=True)
        self.name = config.get("name", config.get("registrar", "sip-profile"))
        self.registrar = config.get("registrar", "127.0.0.1:5060")
        self.interval = int(config.get("interval", default_interval))
        self.timeout = float(config.get("timeout", default_timeout))
        self.expected_response = config.get("expected_response", "SIP/2.0")
        self.transport = config.get("transport", "udp").lower()
        self.jitter_threshold = float(config.get("jitter_threshold_ms", 50))
        self.mos_threshold = float(config.get("mos_threshold", 3.5))
        self._stop_event = threading.Event()
        self.latency_history: Deque[float] = deque(maxlen=8)

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        LOGGER.info("Starting VoIP probe for %s (%s)", self.name, self.registrar)
        while not self._stop_event.is_set():
            self._execute_probe()
            self._stop_event.wait(self.interval)

    def _execute_probe(self) -> None:
        labels = {"name": self.name, "registrar": self.registrar}
        start_time = time.perf_counter()
        message = ""
        success = False
        jitter_ms = 0.0
        mos = 1.0
        try:
            response_line, latency = self._send_options()
            success = self.expected_response in response_line
            jitter_ms = self._compute_jitter(latency)
            mos = self._compute_mos(latency, jitter_ms)
            if success:
                message = response_line
            else:
                message = f"Unexpected response: {response_line}"
        except Exception as exc:  # pylint: disable=broad-except
            message = f"Probe error: {exc}"
            LOGGER.warning("VoIP probe %s failed: %s", self.name, exc)
        finally:
            duration = time.perf_counter() - start_time
            state = self._determine_state(success, jitter_ms, mos)
            SUCCESS_GAUGE.labels(**labels).set(1 if success else 0)
            DURATION_GAUGE.labels(**labels).set(duration)
            JITTER_GAUGE.labels(**labels).set(jitter_ms)
            MOS_GAUGE.labels(**labels).set(mos)
            STATE_ENUM.labels(**labels).state(state)
            MESSAGE_INFO.labels(**labels).info({"message": message or ("success" if success else "failure")})
            LAST_RUN_GAUGE.labels(**labels).set(time.time())
            LOGGER.debug(
                "VoIP probe %s completed in %.3fs (jitter %.2f ms, MOS %.2f): %s",
                self.name,
                duration,
                jitter_ms,
                mos,
                message,
            )

    def _send_options(self) -> Tuple[str, float]:
        host, port = parse_host_port(self.registrar)
        payload = build_sip_options(host)
        sock_type = socket.SOCK_DGRAM if self.transport == "udp" else socket.SOCK_STREAM
        with socket.socket(socket.AF_INET, sock_type) as sock:
            sock.settimeout(self.timeout)
            start = time.perf_counter()
            if self.transport == "tcp":
                sock.connect((host, port))
                sock.sendall(payload.encode("utf-8"))
                data = sock.recv(2048)
            else:
                sock.sendto(payload.encode("utf-8"), (host, port))
                data, _ = sock.recvfrom(2048)
            latency = time.perf_counter() - start
        line = data.decode(errors="ignore").split("\r\n", 1)[0]
        return line, latency

    def _compute_jitter(self, latency: float) -> float:
        self.latency_history.append(latency)
        if len(self.latency_history) < 2:
            return 0.0
        deltas = [abs(self.latency_history[i] - self.latency_history[i - 1]) for i in range(1, len(self.latency_history))]
        return sum(deltas) / len(deltas) * 1000.0

    def _compute_mos(self, latency: float, jitter_ms: float) -> float:
        latency_ms = latency * 1000.0
        effective_latency = latency_ms + (jitter_ms * 2)
        r_factor = max(0.0, 100.0 - (effective_latency / 2.0))
        mos = 1.0 + (0.035 * r_factor) + (r_factor * (r_factor - 60.0) * (100.0 - r_factor) * 7e-6)
        return max(1.0, min(4.5, mos))

    def _determine_state(self, success: bool, jitter_ms: float, mos: float) -> str:
        if not success:
            return "poor"
        if jitter_ms <= self.jitter_threshold and mos >= self.mos_threshold:
            return "excellent"
        return "acceptable"


def main() -> None:
    config = load_config(CONFIG_PATH)
    interval = int(config.get("interval", DEFAULT_INTERVAL))
    timeout = float(config.get("timeout", DEFAULT_TIMEOUT))
    probes: List[VoipProbe] = []

    for profile in config.get("profiles", []):
        if not profile.get("registrar"):
            LOGGER.warning("Skipping VoIP profile without registrar: %s", profile)
            continue
        probe = VoipProbe(profile, interval, timeout)
        probe.start()
        probes.append(probe)

    start_http_server(DEFAULT_PORT)
    LOGGER.info("VoIP exporter listening on %s", DEFAULT_PORT)

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        LOGGER.info("Stopping VoIP exporter")
        for probe in probes:
            probe.stop()


if __name__ == "__main__":
    main()
