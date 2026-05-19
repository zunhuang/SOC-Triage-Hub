from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.auth import require_admin
from app.core.config import settings as env_settings
from app.core.logger import log_json
from app.db.mongo import get_db
from app.services.settings_service import get_settings
from app.services.sync_service import run_jira_sync
from app.services.triage_orchestrator import queue_triage

router = APIRouter(prefix="/api/cron", tags=["cron"], dependencies=[Depends(require_admin)])


def _get_scheduler():
    from app.main import scheduler
    return scheduler


def _get_sync_job():
    from app.main import scheduled_sync_job
    return scheduled_sync_job


def _get_queue_sync_job():
    from app.main import scheduled_queue_sync_job
    return scheduled_queue_sync_job


@router.get("/status")
async def scheduler_status(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    sched = _get_scheduler()
    running = sched.running
    runtime = await get_settings(db)
    queues = runtime.get("queues", [])

    if queues:
        # Per-queue status
        queue_jobs = []
        for q in queues:
            qt = q["queueType"]
            job_id = f"queue-sync-{qt.replace('_', '-')}"
            job = sched.get_job(job_id) if running else None
            queue_jobs.append({
                "queueType": qt,
                "enabled": q.get("enableScheduler", False),
                "jobScheduled": job is not None,
                "nextRunAt": job.next_run_time.astimezone(timezone.utc).isoformat() if job and job.next_run_time else None,
                "intervalMinutes": int(job.trigger.interval.total_seconds() / 60) if job else q.get("pollIntervalMinutes", 5),
            })
        return {
            "mode": "per_queue",
            "running": running,
            "queues": queue_jobs,
            # Legacy fields for backward compat with frontend polling
            "enabled": any(q.get("enableScheduler") for q in queues),
            "jobScheduled": any(j["jobScheduled"] for j in queue_jobs),
            "nextRunAt": next((j["nextRunAt"] for j in queue_jobs if j["nextRunAt"]), None),
            "intervalMinutes": None,
        }

    # Legacy single-job status
    enabled = runtime.get("enableScheduler", False) or env_settings.ENABLE_INTERNAL_SCHEDULER
    job = sched.get_job("jira-sync") if running else None
    result: dict = {
        "mode": "legacy",
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
    """Start, stop, or reconfigure scheduler jobs based on current settings."""
    runtime = await get_settings(db)
    queues = runtime.get("queues", [])
    sched = _get_scheduler()

    if queues:
        expected_ids = {
            f"queue-sync-{q['queueType'].replace('_', '-')}"
            for q in queues
            if q.get("enableScheduler")
        }

        # Remove stale queue jobs
        for job in sched.get_jobs():
            if job.id.startswith("queue-sync-") and job.id not in expected_ids:
                job.remove()

        # Add/update queue jobs
        any_enabled = False
        for q in queues:
            qt = q["queueType"]
            job_id = f"queue-sync-{qt.replace('_', '-')}"
            if q.get("enableScheduler"):
                if not sched.running:
                    sched.start()
                sched.add_job(
                    _get_queue_sync_job(),
                    trigger="interval",
                    minutes=q.get("pollIntervalMinutes", 5),
                    id=job_id,
                    args=[qt],
                    replace_existing=True,
                )
                any_enabled = True
            else:
                existing_job = sched.get_job(job_id)
                if existing_job:
                    existing_job.remove()

        if not any_enabled and sched.running and not sched.get_jobs():
            sched.shutdown(wait=False)

        log_json("info", "scheduler", "apply", "Per-queue scheduler reconfigured")
        return {"running": sched.running, "mode": "per_queue", "message": "Per-queue schedulers applied"}

    # Legacy fallback
    enabled = runtime.get("enableScheduler", False) or env_settings.ENABLE_INTERNAL_SCHEDULER
    jira_settings = runtime.get("jira", {})
    poll_minutes = jira_settings.get("pollIntervalMinutes") or env_settings.JIRA_POLL_INTERVAL_MINUTES

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
    log_json("info", "scheduler", "apply", "Legacy scheduler reconfigured", intervalMinutes=poll_minutes)

    return {
        "running": True,
        "mode": "legacy",
        "intervalMinutes": poll_minutes,
        "nextRunAt": next_run,
        "message": f"Scheduler running every {poll_minutes} min",
    }
