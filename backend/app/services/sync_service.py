"""Jira sync logic with deduplication and state updates."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.activity_service import record_activity
from app.services.incident_normalization import canonicalize_triage_status
from app.services.jira_client import JiraClient
from app.services.settings_service import get_settings
from app.utils.hash import compute_sync_hash

PRIORITY_RANK = {
    "Highest": 1,
    "High": 2,
    "Medium": 3,
    "Low": 4,
    "Lowest": 5,
}


def _normalize_custom_field(raw: Any) -> str | None:
    """customfield_17701 can be null, a plain string, or {"value": "..."} shape."""
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw.strip() or None
    if isinstance(raw, dict):
        val = raw.get("value")
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def map_jira_issue(raw: dict[str, Any]) -> dict[str, Any]:
    fields = raw.get("fields", {})

    priority_name = (fields.get("priority") or {}).get("name", "Medium")
    priority_rank = PRIORITY_RANK.get(priority_name, 99)

    key_fields = {
        "jiraKey": raw.get("key", ""),
        "summary": fields.get("summary", ""),
        "status": (fields.get("status") or {}).get("name", "Open"),
        "priority": priority_name,
        "assignee": (fields.get("assignee") or {}).get("displayName"),
        "description": fields.get("description") or "",
        "project": (fields.get("project") or {}).get("key", ""),
        "mxdrModule": _normalize_custom_field(fields.get("customfield_17701")),
    }

    timestamp = datetime.now(timezone.utc)

    return {
        "jiraKey": key_fields["jiraKey"],
        "jiraId": str(raw.get("id", "")),
        "project": key_fields["project"],
        "projectName": (fields.get("project") or {}).get("name", ""),
        "summary": key_fields["summary"],
        "status": key_fields["status"],
        "priority": key_fields["priority"],
        "priorityRank": priority_rank,
        "assignee": key_fields["assignee"],
        "description": key_fields["description"],
        "mxdrModule": key_fields["mxdrModule"],
        "jiraRawData": raw,
        "syncHash": compute_sync_hash(key_fields),
        "lastSyncedAt": timestamp,
        "updatedAt": timestamp,
    }


async def run_jira_sync(db: AsyncIOMotorDatabase) -> dict[str, int | list[str]]:
    runtime_settings = await get_settings(db)
    client = JiraClient.from_settings(runtime_settings)
    issues = await client.fetch_issues(max_results=100)

    summary: dict[str, int | list[str]] = {
        "new": 0,
        "updated": 0,
        "unchanged": 0,
        "closed": 0,
        "newIncidentIds": [],
    }

    for raw in issues:
        mapped = map_jira_issue(raw)
        existing = await db.incidents.find_one({"jiraKey": mapped["jiraKey"]})

        if existing is None:
            mapped.update(
                {
                    "triageStatus": "For Triage",
                    "activityLog": [
                        {
                            "timestamp": datetime.now(timezone.utc),
                            "action": "sync",
                            "actor": "system",
                            "details": "New issue synced from Jira",
                        }
                    ],
                    "createdAt": datetime.now(timezone.utc),
                }
            )
            insert_result = await db.incidents.insert_one(mapped)
            await record_activity(
                db,
                action="Issue Synced",
                message=f"{mapped['jiraKey']} imported from Jira",
                actor="system",
                incident_number=mapped["jiraKey"],
            )
            summary["new"] = int(summary["new"]) + 1
            summary["newIncidentIds"].append(str(insert_result.inserted_id))
            continue

        if existing.get("syncHash") == mapped["syncHash"]:
            summary["unchanged"] = int(summary["unchanged"]) + 1
            continue

        update_doc = {
            **mapped,
            "activityLog": [
                *existing.get("activityLog", []),
                {
                    "timestamp": datetime.now(timezone.utc),
                    "action": "sync",
                    "actor": "system",
                    "details": "Issue updated from Jira",
                },
            ],
        }

        status_value = str(mapped.get("status", "")).lower()
        if status_value in {"resolved", "closed", "done"}:
            update_doc["triageStatus"] = "Closed" if status_value == "closed" else "Resolved"
            summary["closed"] = int(summary["closed"]) + 1
        else:
            update_doc["triageStatus"] = canonicalize_triage_status(
                existing.get("triageStatus", "For Triage")
            )

        await db.incidents.update_one({"_id": existing["_id"]}, {"$set": update_doc})
        summary["updated"] = int(summary["updated"]) + 1

    await record_activity(
        db,
        action="Jira Sync",
        message=(
            f"Sync complete: {summary['new']} new, {summary['updated']} updated, "
            f"{summary['unchanged']} unchanged, {summary['closed']} closed"
        ),
        actor="system",
    )

    return summary
