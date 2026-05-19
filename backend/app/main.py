"""Detect and Respond FastAPI middleware service."""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import ASCENDING

from app.core.config import settings
from app.core.errors import AppError
from app.core.logger import log_json
from app.db.mongo import close_mongo, connect_mongo, get_db
from app.routers import activity, cron, health, incidents, jira, kindo, settings as settings_router
from app.routers import queues as queues_router
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.services.settings_service import get_settings as get_runtime_settings
from app.services.sync_service import run_jira_sync, run_queue_sync
from app.services.triage_orchestrator import queue_triage, queue_triage_with_agent

scheduler = AsyncIOScheduler()


async def ensure_core_collections() -> None:
    db = get_db()
    existing = set(await db.list_collection_names())
    required = {"incidents", "agents", "triage_runs", "app_settings", "activity_feed"}

    for collection_name in required:
        if collection_name not in existing:
            await db.create_collection(collection_name)

    await db.incidents.create_index([("jiraKey", ASCENDING)], unique=True)
    await db.incidents.create_index([("triageStatus", ASCENDING)])
    await db.incidents.create_index([("priorityRank", ASCENDING), ("createdAt", ASCENDING)])
    await db.incidents.create_index([("queueType", ASCENDING)])
    await db.agents.create_index([("kindoAgentId", ASCENDING)], unique=True)
    await db.triage_runs.create_index([("kindoRunId", ASCENDING)], unique=True)
    await db.activity_feed.create_index([("timestamp", ASCENDING)])

    # Users collection
    if "users" not in existing:
        await db.create_collection("users")
    await db.users.create_index([("email", ASCENDING)], unique=True)
    await db.users.create_index([("azure_oid", ASCENDING)], unique=True, sparse=True)


async def _seed_admin() -> None:
    """Create the default admin account on first startup if no users exist."""
    if not settings.ADMIN_PASSWORD:
        return
    db = get_db()
    if await db.users.count_documents({}) > 0:
        return
    from datetime import timezone
    from app.utils.auth import get_password_hash
    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "email": settings.ADMIN_EMAIL.lower(),
        "password_hash": get_password_hash(settings.ADMIN_PASSWORD),
        "first_name": "Admin",
        "last_name": None,
        "role": "admin",
        "auth_provider": "local",
        "azure_oid": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
    })
    log_json("info", "api", "startup", f"Created default admin: {settings.ADMIN_EMAIL}")


async def scheduled_sync_job() -> None:
    """Legacy fallback job used when no queues array is configured."""
    db = get_db()
    summary = await run_jira_sync(db)
    runtime = await get_runtime_settings(db)

    if runtime.get("autoTriageEnabled") and summary.get("newIncidentIds"):
        await queue_triage(db, list(summary["newIncidentIds"]))


async def scheduled_queue_sync_job(queue_type: str) -> None:
    db = get_db()
    runtime = await get_runtime_settings(db)
    queue_cfg = next((q for q in runtime.get("queues", []) if q["queueType"] == queue_type), None)
    if not queue_cfg:
        return
    summary = await run_queue_sync(db, queue_type, queue_cfg)
    if queue_cfg.get("autoTriageEnabled") and summary.get("newIncidentIds"):
        await queue_triage_with_agent(db, list(summary["newIncidentIds"]), queue_cfg.get("agentId"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await connect_mongo()
    except Exception as exc:
        log_json("error", "api", "startup", f"MongoDB connection failed: {exc}")
        raise SystemExit(f"Cannot start: MongoDB connection failed — {exc}") from exc
    await ensure_core_collections()
    await _seed_admin()
    log_json("info", "api", "startup", "MongoDB connected")

    runtime = await get_runtime_settings(get_db())
    queues = runtime.get("queues", [])

    if queues:
        # Per-queue scheduler jobs
        any_enabled = False
        for queue_cfg in queues:
            if not queue_cfg.get("enableScheduler"):
                continue
            qt = queue_cfg["queueType"]
            scheduler.add_job(
                scheduled_queue_sync_job,
                trigger="interval",
                minutes=queue_cfg.get("pollIntervalMinutes", 5),
                id=f"queue-sync-{qt.replace('_', '-')}",
                args=[qt],
                replace_existing=True,
            )
            any_enabled = True
        if any_enabled:
            scheduler.start()
            log_json("info", "scheduler", "start", "Per-queue schedulers started", queueCount=len(queues))
    else:
        # Migration fallback: use legacy flat settings
        enable_scheduler = runtime.get("enableScheduler", False) or settings.ENABLE_INTERNAL_SCHEDULER
        jira_settings = runtime.get("jira", {})
        poll_minutes = jira_settings.get("pollIntervalMinutes") or settings.JIRA_POLL_INTERVAL_MINUTES
        if enable_scheduler:
            scheduler.add_job(
                scheduled_sync_job,
                trigger="interval",
                minutes=poll_minutes,
                id="jira-sync",
                replace_existing=True,
            )
            scheduler.start()
            log_json("info", "scheduler", "start", "Legacy scheduler started", intervalMinutes=poll_minutes)

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
    await close_mongo()
    log_json("info", "api", "shutdown", "Service stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FastAPI middleware for Detect and Respond",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"error": error.message, "code": error.code, "details": error.details},
    )


@app.exception_handler(Exception)
async def generic_error_handler(_: Request, error: Exception) -> JSONResponse:
    log_json("error", "api", "unhandled_exception", str(error))
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "code": "internal_server_error",
            "details": {"timestamp": datetime.now(timezone.utc).isoformat()},
        },
    )


app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(health.router)
app.include_router(incidents.router)
app.include_router(kindo.router)
app.include_router(settings_router.router)
app.include_router(cron.router)
app.include_router(activity.router)
app.include_router(jira.router)
app.include_router(queues_router.router, prefix="/api/queues")


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "message": "Detect and Respond Middleware",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
