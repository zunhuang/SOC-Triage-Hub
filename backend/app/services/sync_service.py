"""ServiceNow sync logic with deduplication and state updates."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote, urlparse

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.incident import SEVERITY_RANK
from app.services.activity_service import record_activity
from app.services.incident_normalization import canonicalize_triage_status
from app.services.servicenow_client import ServiceNowClient
from app.services.settings_service import get_settings
from app.utils.hash import compute_sync_hash


def _normalize_severity(raw_value: str | None) -> str:
    mapping = {
        "1": "Critical",
        "2": "High",
        "3": "Medium",
        "4": "Low",
        "critical": "Critical",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
    }
    if not raw_value:
        return "Medium"
    normalized = str(raw_value).strip().lower()
    if normalized in mapping:
        return mapping[normalized]

    # Handles values like "1 - Critical", "2 - High", etc.
    if normalized and normalized[0] in {"1", "2", "3", "4"}:
        return mapping.get(normalized[0], "Medium")

    return "Medium"


def _severity_from_priority(raw_priority: str | None) -> str | None:
    if not raw_priority:
        return None
    normalized = str(raw_priority).strip().lower()
    if not normalized:
        return None

    if normalized.startswith("1") or "critical" in normalized:
        return "Critical"
    if normalized.startswith("2") or "high" in normalized:
        return "High"
    if normalized.startswith("3") or "moderate" in normalized or "medium" in normalized:
        return "Medium"
    if normalized.startswith("4") or "low" in normalized:
        return "Low"
    if normalized.startswith("5") or "planning" in normalized:
        return "Low"
    return None


def _normalize_reference(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        display = raw.get("display_value")
        if isinstance(display, str) and display.strip():
            return display
        value = raw.get("value")
        if isinstance(value, str) and value.strip():
            return value
        link = raw.get("link")
        if isinstance(link, str) and link.strip():
            parsed = urlparse(link)
            path_tail = unquote(parsed.path.rstrip("/").split("/")[-1]) if parsed.path else ""
            if path_tail:
                return path_tail
            return link
    return str(raw)


def _parse_datetime(raw: Any) -> datetime:
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str):
        sanitized = raw.replace("Z", "+00:00").replace(" ", "T")
        try:
            return datetime.fromisoformat(sanitized)
        except ValueError:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def map_servicenow_incident(raw: dict[str, Any]) -> dict[str, Any]:
    priority_value = _normalize_reference(raw.get("priority")) or "3 - Moderate"
    severity = _severity_from_priority(priority_value) or _normalize_severity(raw.get("severity"))

    key_fields = {
        "number": _normalize_reference(raw.get("number")) or "UNKNOWN",
        "short_description": _normalize_reference(raw.get("short_description")),
        "description": _normalize_reference(raw.get("description")),
        "severity": severity,
        "priority": priority_value,
        "state": _normalize_reference(raw.get("state")) or "New",
        "assignment_group": _normalize_reference(raw.get("assignment_group")),
        "assigned_to": _normalize_reference(raw.get("assigned_to")),
        "caller": _normalize_reference(raw.get("caller_id")),
        "category": _normalize_reference(raw.get("category")),
        "subcategory": _normalize_reference(raw.get("subcategory")),
        "configuration_item": _normalize_reference(raw.get("cmdb_ci")),
        "opened_at": _normalize_reference(raw.get("opened_at")),
        "updated_at": _normalize_reference(raw.get("sys_updated_on")),
    }

    timestamp = datetime.now(timezone.utc)

    return {
        "snowIncidentId": raw.get("sys_id"),
        "number": key_fields["number"],
        "shortDescription": key_fields["short_description"],
        "description": key_fields["description"],
        "severity": severity,
        "severityRank": SEVERITY_RANK[severity],
        "priority": key_fields["priority"],
        "state": key_fields["state"],
        "assignmentGroup": key_fields["assignment_group"],
        "assignedTo": key_fields["assigned_to"],
        "caller": key_fields["caller"],
        "category": key_fields["category"],
        "subcategory": key_fields["subcategory"],
        "configurationItem": key_fields["configuration_item"],
        "openedAt": _parse_datetime(key_fields["opened_at"]),
        "updatedAt": _parse_datetime(key_fields["updated_at"]),
        "snowRawData": raw,
        "syncHash": compute_sync_hash(key_fields),
        "lastSyncedAt": timestamp,
        "updatedAtLocal": timestamp,
    }


async def run_servicenow_sync(db: AsyncIOMotorDatabase) -> dict[str, int | list[str]]:
    runtime_settings = await get_settings(db)
    client = ServiceNowClient.from_settings(runtime_settings)
    records = await client.fetch_open_incidents(limit=100, offset=0)

    summary: dict[str, int | list[str]] = {
        "new": 0,
        "updated": 0,
        "unchanged": 0,
        "closed": 0,
        "newIncidentIds": [],
    }

    for raw in records:
        mapped = map_servicenow_incident(raw)
        existing = await db.incidents.find_one({"snowIncidentId": mapped["snowIncidentId"]})

        if existing is None:
            mapped.update(
                {
                    "triageStatus": "For Triage",
                    "activityLog": [
                        {
                            "timestamp": datetime.now(timezone.utc),
                            "action": "sync",
                            "actor": "system",
                            "details": "New incident synced from ServiceNow",
                        }
                    ],
                    "createdAt": datetime.now(timezone.utc),
                }
            )
            insert_result = await db.incidents.insert_one(mapped)
            await record_activity(
                db,
                action="Incident Synced",
                message=f"{mapped['number']} imported from ServiceNow",
                actor="system",
                incident_number=mapped["number"],
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
                    "details": "Incident updated from ServiceNow",
                },
            ],
        }

        state_value = str(mapped.get("state", "")).lower()
        if state_value in {"resolved", "closed"}:
            update_doc["triageStatus"] = "Closed" if state_value == "closed" else "Resolved"
            summary["closed"] = int(summary["closed"]) + 1
        else:
            update_doc["triageStatus"] = canonicalize_triage_status(existing.get("triageStatus", "For Triage"))

        await db.incidents.update_one({"_id": existing["_id"]}, {"$set": update_doc})
        summary["updated"] = int(summary["updated"]) + 1

    await record_activity(
        db,
        action="ServiceNow Sync",
        message=(
            f"Sync complete: {summary['new']} new, {summary['updated']} updated, "
            f"{summary['unchanged']} unchanged, {summary['closed']} closed"
        ),
        actor="system",
    )

    return summary
