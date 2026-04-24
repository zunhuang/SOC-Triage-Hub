"""Kindo triage orchestration and run polling."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import AppError
from app.services.activity_service import record_activity
from app.services.kindo_client import KindoClient
from app.services.settings_service import get_settings


def _parse_json_payload(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def _extract_agent_report(raw: Any) -> str:
    """Extract human-readable text from a Kindo agent response.

    Kindo returns a parts array with step-starts, tool calls, and text blocks.
    The final report is typically the longest text part at the end.
    """
    obj = raw
    if isinstance(raw, str):
        try:
            obj = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw

    if not isinstance(obj, dict) or "parts" not in obj:
        if isinstance(raw, (dict, list)):
            return json.dumps(raw, indent=2, default=str)
        return str(raw)

    parts = obj["parts"]
    text_parts = [p["text"].strip() for p in parts if p.get("type") == "text" and p.get("text", "").strip()]

    if not text_parts:
        return json.dumps(obj, indent=2, default=str)

    # The final report is usually the last and longest text block
    return text_parts[-1]


def _parse_remediation_steps(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            return []
    return []


_KINDO_INPUT_MAP: dict[str, tuple[str, ...]] = {
    "jira ticket number": ("jiraKey",),
    "jira ticket": ("jiraKey",),
    "ticket number": ("jiraKey",),
    "ticket": ("jiraKey",),
    "client": ("projectName", "project"),
    "module": ("mxdrModule",),
    "summary": ("summary",),
    "description": ("description",),
    "priority": ("priority",),
    "status": ("status",),
    "assignee": ("assignee",),
    "project": ("project", "projectName"),
}


def _build_agent_inputs(incident: dict[str, Any], expected_inputs: list[str]) -> dict[str, str]:
    """Map incident fields to the agent's expected input names."""
    result: dict[str, str] = {}
    for input_name in expected_inputs:
        key = input_name.strip().lower()
        source_fields = _KINDO_INPUT_MAP.get(key)
        if source_fields:
            for field in source_fields:
                val = incident.get(field)
                if val not in (None, ""):
                    result[input_name] = str(val)
                    break
            else:
                result[input_name] = ""
        else:
            result[input_name] = ""
    return result


async def _poll_run(client: KindoClient, agent_id: str, run_id: str) -> dict[str, Any]:
    start = datetime.now(timezone.utc)
    wait_seconds = 2

    while True:
        run = await client.get_run_result(agent_id, run_id)
        status = str(run.get("status", "")).lower()

        if status in {"completed", "success", "succeeded"}:
            return run
        if status in {"failed", "error", "cancelled"}:
            return run

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        if elapsed >= 600:
            return {"status": "failed", "error": "Polling timeout after 10 minutes"}

        await asyncio.sleep(wait_seconds)
        wait_seconds = min(wait_seconds * 2, 30)


async def run_triage_for_incident(
    db: AsyncIOMotorDatabase,
    incident_id: str,
    agent_id_override: str | None = None,
) -> None:
    incident = await db.incidents.find_one({"_id": ObjectId(incident_id)})
    if not incident:
        raise AppError(message="Incident not found", code="incident_not_found", status_code=404)

    settings = await get_settings(db)
    agent_id = agent_id_override or settings.get("selectedTriageAgentId")

    if not agent_id:
        active = await db.agents.find_one(
            {
                "isActive": True,
                "purpose": "triage",
                "agentType": {"$in": ["workflow", "chatbot"]},
            }
        )
        if active:
            agent_id = active.get("kindoAgentId")

    if not agent_id:
        raise AppError(message="No active triage agent configured", code="missing_triage_agent", status_code=400)

    await db.incidents.update_one(
        {"_id": incident["_id"]},
        {
            "$set": {
                "triageStatus": "Triage In Progress",
                "triageStartedAt": datetime.now(timezone.utc),
                "updatedAtLocal": datetime.now(timezone.utc),
            }
        },
    )

    client = KindoClient.from_settings(settings)

    agent_doc = await db.agents.find_one({"kindoAgentId": agent_id})
    expected_inputs = (agent_doc or {}).get("kindoMetadata", {}).get("inputs", [])

    if expected_inputs and isinstance(expected_inputs, list):
        mapped = _build_agent_inputs(incident, expected_inputs)
        payload = {"inputs": mapped}
    else:
        payload = {
            "inputs": {
                "jiraKey": incident.get("jiraKey", ""),
                "jiraId": incident.get("jiraId", ""),
                "project": incident.get("project", ""),
                "projectName": incident.get("projectName", ""),
                "summary": incident.get("summary", ""),
                "description": incident.get("description", ""),
                "priority": incident.get("priority", ""),
                "priorityRank": incident.get("priorityRank", 99),
                "status": incident.get("status", ""),
                "assignee": incident.get("assignee", ""),
                "mxdrModule": incident.get("mxdrModule", ""),
                "createdAt": str(incident.get("createdAt", "")),
                "updatedAt": str(incident.get("updatedAt", "")),
                "re-triage": True,
            }
        }

    run_id = None
    try:
        submission = await client.invoke_agent(agent_id, payload)
        run_id = (
            submission.get("runId")
            or submission.get("id")
            or submission.get("run_id")
            or submission.get("data", {}).get("id")
        )

        if not run_id:
            raise AppError(message="Kindo did not return a run ID", code="kindo_missing_run_id", status_code=502)

        triage_run = {
            "incidentId": incident["_id"],
            "jiraKey": incident.get("jiraKey"),
            "kindoAgentId": agent_id,
            "kindoRunId": run_id,
            "status": "running",
            "startedAt": datetime.now(timezone.utc),
            "input": payload,
            "createdAt": datetime.now(timezone.utc),
        }
        await db.triage_runs.insert_one(triage_run)

        run_result = await _poll_run(client, agent_id, run_id)
    except Exception as exc:
        error_message = str(exc)
        await db.incidents.update_one(
            {"_id": incident["_id"]},
            {
                "$set": {
                    "triageStatus": "Triage Failed",
                    "updatedAtLocal": datetime.now(timezone.utc),
                    "triageResults": {
                        "agentOutput": f"Triage failed: {error_message}",
                        "triageAgent": agent_id,
                        "kindoRunId": run_id or "",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    },
                },
                "$push": {
                    "activityLog": {
                        "timestamp": datetime.now(timezone.utc),
                        "action": "triage",
                        "actor": "kindo-agent",
                        "details": error_message,
                    }
                },
            },
        )
        if run_id:
            await db.triage_runs.update_one(
                {"incidentId": incident["_id"], "kindoRunId": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                        "error": error_message,
                    }
                },
            )
        await record_activity(
            db,
            action="Triage Failed",
            message=f"{incident.get('jiraKey')} triage failed: {error_message}",
            actor="kindo-agent",
            incident_number=incident.get("jiraKey"),
            level="error",
        )
        return

    status = str(run_result.get("status", "")).lower()

    if status in {"failed", "error", "cancelled"}:
        error_message = str(run_result.get("error") or "Kindo run failed")
        await db.incidents.update_one(
            {"_id": incident["_id"]},
            {
                "$set": {
                    "triageStatus": "Triage Failed",
                    "updatedAtLocal": datetime.now(timezone.utc),
                    "triageResults": {
                        "agentOutput": f"Triage failed: {error_message}",
                        "triageAgent": agent_id,
                        "kindoRunId": run_id or "",
                        "completedAt": datetime.now(timezone.utc).isoformat(),
                    },
                },
                "$push": {
                    "activityLog": {
                        "timestamp": datetime.now(timezone.utc),
                        "action": "triage",
                        "actor": "kindo-agent",
                        "details": error_message,
                    }
                },
            },
        )
        await db.triage_runs.update_one(
            {"incidentId": incident["_id"], "kindoRunId": run_id},
            {
                "$set": {
                    "status": "failed",
                    "completedAt": datetime.now(timezone.utc),
                    "error": error_message,
                }
            },
        )
        await record_activity(
            db,
            action="Triage Failed",
            message=f"{incident.get('jiraKey')} triage failed: {error_message}",
            actor="kindo-agent",
            incident_number=incident.get("jiraKey"),
            level="error",
        )
        return

    output = run_result.get("output") or run_result.get("result") or run_result.get("data") or {}
    raw_text = _extract_agent_report(output)

    triage_results = {
        "agentOutput": raw_text,
        "triageAgent": agent_id,
        "kindoRunId": run_id,
        "completedAt": datetime.now(timezone.utc),
    }

    await db.incidents.update_one(
        {"_id": incident["_id"]},
        {
            "$set": {
                "triageStatus": "Triage Complete",
                "triageCompletedAt": datetime.now(timezone.utc),
                "triageResults": triage_results,
                "updatedAtLocal": datetime.now(timezone.utc),
            },
            "$push": {
                "activityLog": {
                    "timestamp": datetime.now(timezone.utc),
                    "action": "triage",
                    "actor": "kindo-agent",
                    "details": "AI triage completed",
                }
            },
        },
    )

    await db.triage_runs.update_one(
        {"incidentId": incident["_id"], "kindoRunId": run_id},
        {
            "$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc),
                "output": output,
            }
        },
    )

    await record_activity(
        db,
        action="Triage Complete",
        message=f"{incident.get('jiraKey')} triage completed",
        actor="kindo-agent",
        incident_number=incident.get("jiraKey"),
    )


async def queue_triage(db: AsyncIOMotorDatabase, incident_ids: list[str]) -> int:
    return await queue_triage_with_agent(db, incident_ids, None)


async def queue_triage_with_agent(
    db: AsyncIOMotorDatabase,
    incident_ids: list[str],
    agent_id: str | None = None,
) -> int:
    accepted = 0
    for incident_id in incident_ids:
        incident = await db.incidents.find_one({"_id": ObjectId(incident_id)})
        if incident is None:
            continue
        asyncio.create_task(run_triage_for_incident(db, incident_id, agent_id_override=agent_id))
        accepted += 1
    return accepted
