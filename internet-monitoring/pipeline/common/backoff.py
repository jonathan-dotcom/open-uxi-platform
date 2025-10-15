"""Exponential backoff helper shared by sensor networking loops."""

from __future__ import annotations

import random
import time
from dataclasses import dataclass


@dataclass
class ExponentialBackoff:
    base: float = 0.5
    factor: float = 2.0
    max_interval: float = 30.0
    jitter: float = 0.1
    _current: float = 0.0

    def reset(self) -> None:
        self._current = 0.0

    def next_interval(self) -> float:
        if self._current == 0.0:
            self._current = self.base
        else:
            self._current = min(self._current * self.factor, self.max_interval)
        jitter_delta = self._current * self.jitter
        return max(0.0, self._current + random.uniform(-jitter_delta, jitter_delta))

    def sleep(self) -> None:
        time.sleep(self.next_interval())
