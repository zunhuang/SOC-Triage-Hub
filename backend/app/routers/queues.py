"""Per-queue manual sync endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.auth import get_current_active_user
from app.core.errors import AppError
from app.db.mongo import get_db
from app.services.settings_service import get_settings
from app.services.sync_service import run_queue_sync

router = APIRouter(tags=["queues"], dependencies=[Depends(get_current_active_user)])

VALID_QUEUE_TYPES = {"soc_triage", "threat_intel", "threat_hunt", "detection_eng"}


@router.post("/{queue_type}/sync")
async def sync_queue(queue_type: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    if queue_type not in VALID_QUEUE_TYPES:
        raise AppError(
            f"Unknown queue type: {queue_type}",
            code="invalid_queue_type",
            status_code=400,
        )
    runtime = await get_settings(db)
    queue_cfg = next(
        (q for q in runtime.get("queues", []) if q["queueType"] == queue_type), None
    )
    if not queue_cfg:
        raise AppError(
            f"Queue '{queue_type}' is not configured",
            code="queue_not_configured",
            status_code=404,
        )
    summary = await run_queue_sync(db, queue_type, queue_cfg)
    return {
        "new": summary["new"],
        "updated": summary["updated"],
        "unchanged": summary["unchanged"],
        "closed": summary["closed"],
    }
