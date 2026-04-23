from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import AppError
from app.db.mongo import get_db
from app.schemas.kindo import AgentPatchRequest, TriageRequest
from app.services.kindo_client import KindoClient
from app.services.settings_service import get_settings
from app.services.triage_orchestrator import queue_triage_with_agent
from app.utils.serialization import serialize

router = APIRouter(prefix="/api/kindo", tags=["kindo"])


def _extract_first_value(payload: Any, keys: tuple[str, ...], depth: int = 0) -> Any:
    if depth > 4:
        return None
    if isinstance(payload, dict):
        for key in keys:
            if key in payload and payload[key] not in (None, ""):
                return payload[key]
        for value in payload.values():
            found = _extract_first_value(value, keys, depth + 1)
            if found not in (None, ""):
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _extract_first_value(item, keys, depth + 1)
            if found not in (None, ""):
                return found
    return None


def _normalize_agent_type(raw_type: Any, agent_payload: dict[str, Any]) -> str:
    if isinstance(raw_type, str) and raw_type.strip():
        normalized = raw_type.strip().lower()
    else:
        has_schedule_metadata = _extract_first_value(agent_payload, ("cron", "schedule", "interval", "trigger")) not in (None, "")
        if has_schedule_metadata:
            normalized = "scheduled"
        else:
            name = str(_extract_first_value(agent_payload, ("name", "agent_name", "title")) or "").lower()
            description = str(_extract_first_value(agent_payload, ("description", "summary")) or "").lower()
            text = f"{name} {description}"
            has_triggers = bool(_extract_first_value(agent_payload, ("hasTriggers", "has_triggers")))
            if has_triggers:
                normalized = "trigger"
            elif any(token in text for token in ("scheduled", "schedule", "hourly", "daily", "weekly", "every ", "cron", "recent")):
                normalized = "scheduled"
            elif "schedule" in text or "cron" in text:
                normalized = "scheduled"
            elif "chat" in text or "assistant" in text:
                normalized = "chatbot"
            else:
                normalized = "workflow"

    if normalized in {"chat", "chat-bot"}:
        return "chatbot"
    if normalized in {"event", "cron", "schedule"}:
        return "scheduled"
    return normalized


async def _fetch_detail(client: KindoClient, agent_id: str) -> dict[str, Any]:
    try:
        return await client.get_agent_details(agent_id)
    except Exception:
        return {}


@router.get("/agents")
async def list_kindo_agents(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[dict]:
    runtime_settings = await get_settings(db)
    client = KindoClient.from_settings(runtime_settings)
    remote_agents = await client.list_agents()

    agent_ids: list[str] = []
    agent_map: dict[str, dict] = {}
    for agent in remote_agents:
        kindo_agent_id = str(
            _extract_first_value(agent, ("id", "_id", "agentId", "agent_id", "uuid")) or ""
        )
        if not kindo_agent_id:
            continue
        name = str(_extract_first_value(agent, ("name", "agent_name", "title")) or "")
        if "CDA" not in name.upper():
            continue
        agent_ids.append(kindo_agent_id)
        agent_map[kindo_agent_id] = agent

    details = await asyncio.gather(*[_fetch_detail(client, aid) for aid in agent_ids])

    for kindo_agent_id, detailed_agent in zip(agent_ids, details):
        agent = agent_map[kindo_agent_id]
        existing = await db.agents.find_one({"kindoAgentId": kindo_agent_id})
        combined = {**agent, **detailed_agent}
        raw_type = _extract_first_value(combined, ("agent_type", "type", "kind", "category", "triggerType"))
        computed_type = _normalize_agent_type(raw_type, combined)
        override_type = (existing or {}).get("agentTypeOverride")
        payload = {
            "kindoAgentId": kindo_agent_id,
            "name": str(_extract_first_value(combined, ("name", "agent_name", "title")) or "Unnamed Agent"),
            "description": str(_extract_first_value(combined, ("description", "summary")) or ""),
            "agentType": str(override_type or computed_type),
            "kindoMetadata": combined,
            "lastSyncedAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "purpose": (existing or {}).get("purpose", "triage"),
            "isActive": (existing or {}).get("isActive", False),
        }
        await db.agents.update_one(
            {"kindoAgentId": kindo_agent_id},
            {
                "$set": payload,
                "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
            },
            upsert=True,
        )

    cursor = db.agents.find({}).sort("name", 1)
    return [serialize(agent) async for agent in cursor]


@router.patch("/agents/{agent_id}")
async def patch_agent(agent_id: str, payload: AgentPatchRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    update_fields: dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}
    if payload.isActive is not None:
        update_fields["isActive"] = payload.isActive
    if payload.agentType is not None:
        update_fields["agentType"] = payload.agentType
        update_fields["agentTypeOverride"] = payload.agentType

    result = await db.agents.update_one({"kindoAgentId": agent_id}, {"$set": update_fields})

    if result.matched_count == 0:
        raise AppError(message="Agent not found", code="agent_not_found", status_code=404)

    updated = await db.agents.find_one({"kindoAgentId": agent_id})
    return serialize(updated)


@router.post("/triage")
async def trigger_triage(payload: TriageRequest, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    accepted = await queue_triage_with_agent(db, payload.incidentIds, payload.agentId)
    return {"accepted": accepted}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    run = await db.triage_runs.find_one({"kindoRunId": run_id})
    if run is None:
        raise AppError(message="Run not found", code="run_not_found", status_code=404)
    return serialize(run)
