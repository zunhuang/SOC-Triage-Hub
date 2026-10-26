"""CDA chat.

- Investigate Further: continues a record's triage-run conversation on Kindo (Responses API). Shared per incident.
- CDA Chat: general assistant (Messages API), not tied to a record. Private per analyst.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings as env_settings
from app.core.errors import AppError, NotFoundError
from app.services.activity_service import record_activity
from app.services.kindo_client import KindoClient
from app.services.settings_service import get_settings

_HISTORY_LIMIT = 20

GENERAL_SYSTEM_PROMPT = (
    "You are CDA, an assistant for SOC analysts inside the Detect and Respond platform. "
    "Help with security operations questions: threat intelligence, detection logic, query writing, "
    "incident handling and reporting. Answer concisely in markdown. You have no access to the analyst's "
    "tickets or security tools in this chat, so say so if asked to look something up, and never invent "
    "ticket numbers, hosts or indicators."
)


@dataclass
class RunChatContext:
    incident: dict[str, Any]
    client: KindoClient
    model: str
    run: dict[str, Any]
    conversation_id: str


def user_display_name(user: dict) -> str:
    name = " ".join(p for p in (user.get("first_name"), user.get("last_name")) if p)
    return name or user.get("email") or "Analyst"


async def latest_completed_run(db: AsyncIOMotorDatabase, incident_id: ObjectId) -> dict | None:
    return await db.triage_runs.find_one(
        {"incidentId": incident_id, "status": "completed"}, sort=[("completedAt", -1)]
    )


def run_context_summary(incident: dict, run: dict | None) -> dict[str, Any]:
    in_progress = incident.get("triageStatus") == "Triage In Progress"
    return {
        "available": run is not None and not in_progress,
        "inProgress": in_progress,
        "runId": run.get("kindoRunId") if run else None,
        "agentId": run.get("kindoAgentId") if run else None,
        "completedAt": run["completedAt"].isoformat() if run and run.get("completedAt") else None,
    }


async def _resolve_run_model(client: KindoClient, kindo_cfg: dict) -> str:
    configured = kindo_cfg.get("runChatModel") or env_settings.KINDO_RUN_CHAT_MODEL
    if configured:
        return configured
    models = await client.list_models()
    if not models:
        raise AppError("No Kindo models available for follow-ups", "no_chat_model", status_code=502)
    return models[0]


async def prepare_run_chat(db: AsyncIOMotorDatabase, incident_id: str) -> RunChatContext:
    """Validate up front so failures are plain HTTP errors, not mid-stream events."""
    try:
        oid = ObjectId(incident_id)
    except Exception:
        raise AppError("Invalid incident id", "invalid_incident_id", status_code=400)
    incident = await db.incidents.find_one({"_id": oid})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")

    runtime = await get_settings(db)
    client = KindoClient.from_settings(runtime)

    run = await latest_completed_run(db, oid)
    if run is None or not run_context_summary(incident, run)["available"]:
        raise AppError(
            "Investigate Further is available once a triage run has completed",
            "run_context_unavailable",
            status_code=409,
        )
    conversation_id = run.get("conversationId")
    if not conversation_id:
        conversation_id = (await client.get_run(run["kindoRunId"])).get("conversationId")
        if not conversation_id:
            raise AppError("Kindo run has no conversation to continue", "run_conversation_missing", status_code=502)
        await db.triage_runs.update_one({"_id": run["_id"]}, {"$set": {"conversationId": conversation_id}})

    model = await _resolve_run_model(client, runtime.get("kindo", {}))
    return RunChatContext(incident=incident, client=client, model=model, run=run, conversation_id=conversation_id)


async def load_history(db: AsyncIOMotorDatabase, query: dict[str, Any]) -> list[dict[str, Any]]:
    cursor = db.chat_messages.find(query).sort("createdAt", 1)
    return [
        {
            "id": str(doc["_id"]),
            "role": doc["role"],
            "content": doc["content"],
            "userName": doc.get("userName"),
            "runId": doc.get("runId"),
            "tools": doc.get("tools") or [],
            "createdAt": doc["createdAt"].isoformat(),
        }
        async for doc in cursor
    ]


def run_history_query(incident_id: ObjectId) -> dict[str, Any]:
    return {"incidentId": incident_id, "mode": "run"}


def general_history_query(user: dict) -> dict[str, Any]:
    return {"incidentId": None, "mode": "general", "userId": user.get("id")}


async def _persist_turn(
    db: AsyncIOMotorDatabase,
    base: dict[str, Any],
    user: dict,
    text: str,
    answer: str,
    tools: list[str] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    result = await db.chat_messages.insert_many(
        [
            {**base, "role": "user", "content": text, "userId": user.get("id"),
             "userName": user_display_name(user), "createdAt": now},
            {**base, "role": "assistant", "content": answer, "userId": user.get("id") if base["mode"] == "general" else None,
             "userName": "CDA", "tools": tools or [], "createdAt": datetime.now(timezone.utc)},
        ]
    )
    return str(result.inserted_ids[1])


async def stream_run_chat(
    db: AsyncIOMotorDatabase, ctx: RunChatContext, user: dict, text: str
) -> AsyncIterator[dict[str, Any]]:
    """Yield `delta` events, then `done`. The turn is persisted only after a complete answer."""
    chunks: list[str] = []
    tools: list[str] = []
    async for event in ctx.client.stream_response(model=ctx.model, conversation_id=ctx.conversation_id, text=text):
        if event["type"] == "delta":
            chunks.append(event["text"])
        else:
            tools.append(event["name"])
        yield event

    answer = "".join(chunks).strip()
    if not answer:
        raise AppError("CDA returned an empty answer", "empty_answer", status_code=502)

    incident_id = ctx.incident["_id"]
    first_message = await db.chat_messages.count_documents({"incidentId": incident_id}, limit=1) == 0
    base = {"incidentId": incident_id, "mode": "run", "runId": ctx.run.get("kindoRunId"), "model": ctx.model}
    message_id = await _persist_turn(db, base, user, text, answer, tools)
    if first_message:
        await record_activity(
            db,
            action="Investigate Further started",
            message=f"{user_display_name(user)} started Investigate Further on {ctx.incident.get('jiraKey')}",
            actor=user_display_name(user),
            incident_number=ctx.incident.get("jiraKey"),
        )
    yield {"type": "done", "messageId": message_id}


async def stream_general_chat(db: AsyncIOMotorDatabase, user: dict, text: str) -> AsyncIterator[dict[str, Any]]:
    runtime = await get_settings(db)
    client = KindoClient.from_settings(runtime)
    model = runtime.get("kindo", {}).get("chatModel") or env_settings.KINDO_CHAT_MODEL

    cursor = db.chat_messages.find(general_history_query(user)).sort("createdAt", -1).limit(_HISTORY_LIMIT)
    history = [{"role": d["role"], "content": d["content"]} async for d in cursor]
    history.reverse()
    while history and history[0]["role"] != "user":
        history.pop(0)
    history.append({"role": "user", "content": text})

    chunks: list[str] = []
    async for delta in client.stream_message(model=model, messages=history, system=GENERAL_SYSTEM_PROMPT):
        chunks.append(delta)
        yield {"type": "delta", "text": delta}

    answer = "".join(chunks).strip()
    if not answer:
        raise AppError("CDA returned an empty answer", "empty_answer", status_code=502)
    base = {"incidentId": None, "mode": "general", "runId": None, "model": model}
    yield {"type": "done", "messageId": await _persist_turn(db, base, user, text, answer)}
