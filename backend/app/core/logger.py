"""Structured JSON logger utility."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
_logger = logging.getLogger("iam-triage-hub")


def log_json(level: str, service: str, action: str, message: str, **extra: Any) -> None:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": service,
        "action": action,
        "message": message,
        **extra,
    }

    text = json.dumps(payload, default=str)
    log_func = getattr(_logger, level.lower(), _logger.info)
    log_func(text)
