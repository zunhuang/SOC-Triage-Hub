from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings as env_settings
from app.core.logger import log_json
from app.db.mongo import get_db
from app.services.settings_service import get_settings
from app.services.sync_service import run_jira_sync
from app.services.triage_orchestrator import queue_triage

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _get_scheduler():
    from app.main import scheduler
    return scheduler


def _get_sync_job():
    from app.main import scheduled_sync_job
    return scheduled_sync_job


@router.get("/status")
async def scheduler_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    sched = _get_scheduler()
    running = sched.running
    job = sched.get_job("jira-sync") if running else None

    runtime = await get_settings(db)
    enabled = runtime.get("enableScheduler", False) or env_settings.ENABLE_INTERNAL_SCHEDULER

    result: dict = {
        "enabled": enabled,
        "running": running,
        "jobScheduled": job is not None,
        "nextRunAt": None,
        "intervalMinutes": None,
    }

    if job and job.next_run_time:
        result["nextRunAt"] = job.next_run_time.astimezone(timezone.utc).isoformat()
        result["intervalMinutes"] = int(job.trigger.interval.total_seconds() / 60)

    return result


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


@router.post("/apply")
async def apply_scheduler(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Start, stop, or reconfigure the scheduler based on current settings."""
    runtime = await get_settings(db)
    enabled = runtime.get("enableScheduler", False) or env_settings.ENABLE_INTERNAL_SCHEDULER
    jira_settings = runtime.get("jira", {})
    poll_minutes = jira_settings.get("pollIntervalMinutes") or env_settings.JIRA_POLL_INTERVAL_MINUTES

    sched = _get_scheduler()

    if not enabled:
        if sched.running:
            existing = sched.get_job("jira-sync")
            if existing:
                sched.remove_job("jira-sync")
            log_json("info", "scheduler", "stop", "Scheduler disabled via settings")
        return {"running": False, "message": "Scheduler disabled"}

    if not sched.running:
        sched.start()

    sched.add_job(
        _get_sync_job(),
        trigger="interval",
        minutes=poll_minutes,
        id="jira-sync",
        replace_existing=True,
    )

    job = sched.get_job("jira-sync")
    next_run = job.next_run_time.astimezone(timezone.utc).isoformat() if job and job.next_run_time else None

    log_json("info", "scheduler", "apply", "Scheduler reconfigured", intervalMinutes=poll_minutes)

    return {
        "running": True,
        "intervalMinutes": poll_minutes,
        "nextRunAt": next_run,
        "message": f"Scheduler running every {poll_minutes} min",
    }
