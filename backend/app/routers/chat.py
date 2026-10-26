"""CDA chat endpoints.

- /api/incidents/{id}/chat  — Investigate Further (continues the triage run's Kindo conversation)
- /api/chat                 — CDA Chat (general assistant, private per analyst)
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.auth import get_current_active_user
from app.core.errors import AppError, NotFoundError
from app.core.logger import log_json
from app.db.mongo import get_db
from app.services import chat_service

_deps = [Depends(get_current_active_user)]
incident_router = APIRouter(prefix="/api/incidents", tags=["chat"], dependencies=_deps)
general_router = APIRouter(prefix="/api/chat", tags=["chat"], dependencies=_deps)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise AppError("Invalid incident id", "invalid_incident_id", status_code=400)


def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _stream(events: AsyncIterator[dict[str, Any]], label: str) -> StreamingResponse:
    async def body() -> AsyncIterator[str]:
        try:
            async for event in events:
                yield _sse(event)
        except AppError as exc:
            log_json("error", "chat", "stream_failed", exc.message, chat=label, details=str(exc.details)[:500])
            yield _sse({"type": "error", "message": exc.message})
        except Exception as exc:  # noqa: BLE001 — surface any failure to the client as a terminal event
            log_json("error", "chat", "stream_failed", str(exc), chat=label)
            yield _sse({"type": "error", "message": "CDA hit an unexpected error."})

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- Investigate Further (per record) ----------------------------------------------------------

@incident_router.get("/{incident_id}/chat")
async def get_investigation(incident_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    oid = _oid(incident_id)
    incident = await db.incidents.find_one({"_id": oid})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")
    run = await chat_service.latest_completed_run(db, oid)
    return {
        "messages": await chat_service.load_history(db, chat_service.run_history_query(oid)),
        "runContext": chat_service.run_context_summary(incident, run),
    }


@incident_router.post("/{incident_id}/chat")
async def post_investigation(
    incident_id: str,
    payload: ChatRequest,
    user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> StreamingResponse:
    text = payload.message.strip()
    if not text:
        raise AppError("Message cannot be empty", "empty_message", status_code=400)
    ctx = await chat_service.prepare_run_chat(db, incident_id)
    return _stream(chat_service.stream_run_chat(db, ctx, user, text), "investigate_further")


# ---- CDA Chat (general, per analyst) -----------------------------------------------------------

@general_router.get("")
async def get_general_chat(
    user: dict = Depends(get_current_active_user), db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    return {"messages": await chat_service.load_history(db, chat_service.general_history_query(user))}


@general_router.post("")
async def post_general_chat(
    payload: ChatRequest,
    user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> StreamingResponse:
    text = payload.message.strip()
    if not text:
        raise AppError("Message cannot be empty", "empty_message", status_code=400)
    return _stream(chat_service.stream_general_chat(db, user, text), "cda_chat")


@general_router.delete("")
async def clear_general_chat(
    user: dict = Depends(get_current_active_user), db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    result = await db.chat_messages.delete_many(chat_service.general_history_query(user))
    return {"deleted": result.deleted_count}
