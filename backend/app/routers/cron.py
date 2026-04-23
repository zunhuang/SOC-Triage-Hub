from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db
from app.services.settings_service import get_settings
from app.services.sync_service import run_jira_sync
from app.services.triage_orchestrator import queue_triage

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.post("")
async def run_cron(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    summary = await run_jira_sync(db)
    settings = await get_settings(db)

    triage_accepted = 0
    if settings.get("autoTriageEnabled") and summary.get("newIncidentIds"):
        triage_accepted = await queue_triage(db, list(summary["newIncidentIds"]))

    return {
        "sync": {
            "new": summary["new"],
            "updated": summary["updated"],
            "unchanged": summary["unchanged"],
            "closed": summary["closed"],
        },
        "autoTriageAccepted": triage_accepted,
    }
