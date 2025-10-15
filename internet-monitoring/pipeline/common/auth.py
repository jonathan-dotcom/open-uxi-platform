"""Shared helpers for bearer-token authentication."""

from __future__ import annotations

import hmac


def extract_bearer(header: str | None) -> str:
    if not header:
        return ""
    prefix = "Bearer "
    if header.startswith(prefix):
        return header[len(prefix) :]
    return header


def constant_time_compare(expected: str | None, received: str | None) -> bool:
    if expected is None or received is None:
        return False
    return hmac.compare_digest(expected, received)
