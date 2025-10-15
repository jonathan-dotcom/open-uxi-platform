"""Alias package that exposes modules living under internet-monitoring/."""

from __future__ import annotations

import pathlib

_REAL_ROOT = pathlib.Path(__file__).resolve().parent.parent / "internet-monitoring"
if not _REAL_ROOT.exists():
    raise ImportError(f"expected {_REAL_ROOT} to exist")

__path__ = [str(_REAL_ROOT)]
