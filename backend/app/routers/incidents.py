from __future__ import annotations

from datetime import datetime, time, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import AppError, NotFoundError
from app.db.mongo import get_db
from app.schemas.incidents import IncidentPatchRequest
from app.services.activity_service import record_activity
from app.services.incident_normalization import canonicalize_triage_status, status_filter_values
from app.services.jira_client import JiraClient
from app.services.settings_service import get_settings
from app.services.sync_service import run_jira_sync
from app.utils.markdown_to_jira import md_to_jira
from app.utils.serialization import serialize

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _to_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise AppError(message="Invalid incident id", code="invalid_id", status_code=400)
    return ObjectId(value)


async def _normalize_and_serialize_incident(db: AsyncIOMotorDatabase, incident: dict) -> dict:
    raw_status = incident.get("triageStatus")
    canonical = canonicalize_triage_status(raw_status)
    if canonical != raw_status:
        await db.incidents.update_one(
            {"_id": incident["_id"]},
            {"$set": {"triageStatus": canonical, "updatedAt": datetime.now(timezone.utc)}},
        )
        incident["triageStatus"] = canonical
    return serialize(incident)


@router.get("")
async def list_incidents(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    priority: str | None = None,
    triageStatus: str | None = None,
    search: str | None = None,
    sortBy: str = "priority",
    sortOrder: str = "desc",
    dateFrom: str | None = None,
    dateTo: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    mongo_filter: dict = {}

    if priority:
        mongo_filter["priority"] = priority
    if triageStatus:
        statuses = status_filter_values(triageStatus)
        if len(statuses) == 1:
            mongo_filter["triageStatus"] = statuses[0]
        else:
            mongo_filter["triageStatus"] = {"$in": statuses}
    if search:
        regex = {"$regex": search, "$options": "i"}
        mongo_filter["$or"] = [
            {"jiraKey": regex},
            {"summary": regex},
            {"description": regex},
        ]

    if dateFrom or dateTo:
        created_at: dict[str, datetime] = {}
        if dateFrom:
            created_at["$gte"] = datetime.combine(
                datetime.fromisoformat(dateFrom).date(), time.min
            ).astimezone(timezone.utc)
        if dateTo:
            created_at["$lte"] = datetime.combine(
                datetime.fromisoformat(dateTo).date(), time.max
            ).astimezone(timezone.utc)
        mongo_filter["createdAt"] = created_at

    total = await db.incidents.count_documents(mongo_filter)

    sort_direction = -1 if sortOrder.lower() == "desc" else 1
    if sortBy == "priority":
        sort_fields = [("priorityRank", sort_direction), ("createdAt", -1)]
    elif sortBy == "createdAt":
        sort_fields = [("createdAt", sort_direction)]
    elif sortBy == "updatedAt":
        sort_fields = [("updatedAt", sort_direction)]
    else:
        sort_fields = [("priorityRank", -1), ("createdAt", -1)]

    cursor = db.incidents.find(mongo_filter).sort(sort_fields).skip((page - 1) * limit).limit(limit)
    data = []
    async for doc in cursor:
        data.append(await _normalize_and_serialize_incident(db, doc))

    return {
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": max((total + limit - 1) // limit, 1),
        },
    }


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    incident = await db.incidents.find_one({"_id": _to_object_id(incident_id)})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")
    return await _normalize_and_serialize_incident(db, incident)


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: str,
    payload: IncidentPatchRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    object_id = _to_object_id(incident_id)
    incident = await db.incidents.find_one({"_id": object_id})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")

    update_doc = payload.model_dump(exclude_none=True)
    if "triageStatus" in update_doc:
        statuses = status_filter_values(update_doc["triageStatus"])
        update_doc["triageStatus"] = statuses[0]
    if update_doc.get("manualNotes"):
        update_doc["$push"] = {
            "activityLog": {
                "timestamp": datetime.now(timezone.utc),
                "action": "note",
                "actor": "user",
                "details": update_doc["manualNotes"],
            }
        }

    update_doc["updatedAt"] = datetime.now(timezone.utc)

    set_doc = {key: value for key, value in update_doc.items() if key != "$push"}
    update_ops: dict = {"$set": set_doc}
    if "$push" in update_doc:
        update_ops["$push"] = update_doc["$push"]

    await db.incidents.update_one({"_id": object_id}, update_ops)
    updated = await db.incidents.find_one({"_id": object_id})
    return serialize(updated)


@router.post("/{incident_id}/post-to-jira")
async def post_triage_to_jira(incident_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    object_id = _to_object_id(incident_id)
    incident = await db.incidents.find_one({"_id": object_id})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")

    jira_key = incident.get("jiraKey")
    if not jira_key:
        raise AppError(message="Incident has no Jira key", code="missing_jira_key", status_code=400)

    triage = incident.get("triageResults", {})
    agent_output = triage.get("agentOutput", "")
    if not agent_output:
        raise AppError(message="No triage output to post", code="no_triage_output", status_code=400)

    jira_body = md_to_jira(agent_output)

    runtime_settings = await get_settings(db)
    client = JiraClient.from_settings(runtime_settings)
    await client.add_comment(jira_key, jira_body)

    await db.incidents.update_one(
        {"_id": object_id},
        {
            "$set": {"triagePostedToJira": True, "triagePostedAt": datetime.now(timezone.utc)},
            "$push": {
                "activityLog": {
                    "timestamp": datetime.now(timezone.utc),
                    "action": "post_to_jira",
                    "actor": "user",
                    "details": f"Triage results posted to {jira_key}",
                }
            },
        },
    )

    await record_activity(
        db,
        action="Posted to Jira",
        message=f"Triage results posted to {jira_key}",
        actor="user",
        incident_number=jira_key,
    )

    return {"posted": True, "jiraKey": jira_key}


@router.delete("/{incident_id}")
async def delete_incident(incident_id: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    object_id = _to_object_id(incident_id)
    incident = await db.incidents.find_one({"_id": object_id})
    if incident is None:
        raise NotFoundError("Incident not found", code="incident_not_found")
    await db.incidents.delete_one({"_id": object_id})
    await db.triage_runs.delete_many({"incidentId": object_id})
    return {"deleted": True, "id": incident_id}


@router.post("/sync")
async def sync_incidents(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    summary = await run_jira_sync(db)
    return {
        "new": summary["new"],
        "updated": summary["updated"],
        "unchanged": summary["unchanged"],
        "closed": summary["closed"],
    }
