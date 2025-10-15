"""Minimal clock-skew estimator for sensors."""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass


@dataclass
class ClockSkewEstimator:
    fallback_skew_ms: float = 0.0
    ntp_server: str = "pool.ntp.org"
    enabled: bool = True
    _last_skew_ms: float = 0.0
    _last_sync_epoch: float = 0.0

    def estimate(self) -> float:
        now = time.time()
        if not self.enabled:
            return self.fallback_skew_ms
        if now - self._last_sync_epoch < 300:
            return self._last_skew_ms
        try:
            output = subprocess.check_output(
                ["ntpdate", "-q", self.ntp_server],
                stderr=subprocess.STDOUT,
                timeout=5,
            ).decode("utf-8")
            # Parse "offset x.y msec" from ntpdate output
            for line in output.splitlines():
                if "offset" in line and "msec" in line:
                    parts = line.split()
                    offset_idx = parts.index("offset")
                    skew = float(parts[offset_idx + 1])
                    self._last_skew_ms = skew
                    self._last_sync_epoch = now
                    return skew
        except Exception:
            pass
        return self.fallback_skew_ms
