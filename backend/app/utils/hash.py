"""Hash helpers for idempotent sync logic."""
from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_sync_hash(payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
