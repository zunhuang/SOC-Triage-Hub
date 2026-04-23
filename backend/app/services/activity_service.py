"""Activity feed persistence helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


async def record_activity(
    db: AsyncIOMotorDatabase,
    *,
    action: str,
    message: str,
    actor: str,
    incident_number: str | None = None,
    level: str = "info",
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc),
        "action": action,
        "message": message,
        "actor": actor,
        "incidentNumber": incident_number,
        "level": level,
    }
    if extra:
        payload["extra"] = extra
    await db.activity_feed.insert_one(payload)


async def list_recent_activity(db: AsyncIOMotorDatabase, limit: int = 50) -> list[dict[str, Any]]:
    cursor = db.activity_feed.find({}, sort=[("timestamp", -1)]).limit(limit)
    return [item async for item in cursor]
