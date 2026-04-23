"""IAM Triage Hub FastAPI middleware service."""
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
from app.services.settings_service import get_settings as get_runtime_settings
from app.services.sync_service import run_jira_sync
from app.services.triage_orchestrator import queue_triage

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
    await db.agents.create_index([("kindoAgentId", ASCENDING)], unique=True)
    await db.triage_runs.create_index([("kindoRunId", ASCENDING)], unique=True)
    await db.activity_feed.create_index([("timestamp", ASCENDING)])


async def scheduled_sync_job() -> None:
    db = get_db()
    summary = await run_jira_sync(db)
    runtime = await get_runtime_settings(db)

    if runtime.get("autoTriageEnabled") and summary.get("newIncidentIds"):
        await queue_triage(db, list(summary["newIncidentIds"]))


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await connect_mongo()
    except Exception as exc:
        log_json("error", "api", "startup", f"MongoDB connection failed: {exc}")
        raise SystemExit(f"Cannot start: MongoDB connection failed — {exc}") from exc
    await ensure_core_collections()
    log_json("info", "api", "startup", "MongoDB connected")

    if settings.ENABLE_INTERNAL_SCHEDULER:
        scheduler.add_job(
            scheduled_sync_job,
            trigger="interval",
            minutes=settings.JIRA_POLL_INTERVAL_MINUTES,
            id="jira-sync",
            replace_existing=True,
        )
        scheduler.start()
        log_json(
            "info",
            "scheduler",
            "start",
            "Internal scheduler started",
            intervalMinutes=settings.JIRA_POLL_INTERVAL_MINUTES,
        )

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
    await close_mongo()
    log_json("info", "api", "shutdown", "Service stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FastAPI middleware for IAM Operations Triage Hub",
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


app.include_router(health.router)
app.include_router(incidents.router)
app.include_router(kindo.router)
app.include_router(settings_router.router)
app.include_router(cron.router)
app.include_router(activity.router)
app.include_router(jira.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "message": "IAM Triage Hub Middleware",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
