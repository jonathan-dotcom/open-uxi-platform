"""Expose pipeline modules under the import-safe package name."""

from __future__ import annotations

import pathlib

_REAL_ROOT = pathlib.Path(__file__).resolve().parent.parent

if not (_REAL_ROOT / "pipeline").exists():
    raise ImportError(f"expected pipeline modules at {_REAL_ROOT / 'pipeline'}")

__path__ = [str(_REAL_ROOT)]
