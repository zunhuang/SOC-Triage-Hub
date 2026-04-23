from __future__ import annotations

from datetime import datetime, time, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.errors import AppError, NotFoundError
from app.db.mongo import get_db
from app.schemas.incidents import IncidentPatchRequest
from app.services.incident_normalization import normalize_incident_document, status_filter_values
from app.services.sync_service import run_servicenow_sync
from app.utils.serialization import serialize

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _to_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise AppError(message="Invalid incident id", code="invalid_id", status_code=400)
    return ObjectId(value)


async def _normalize_and_serialize_incident(db: AsyncIOMotorDatabase, incident: dict) -> dict:
    normalized, updates = normalize_incident_document(incident)
    if updates:
        updates["updatedAtLocal"] = datetime.now(timezone.utc)
        await db.incidents.update_one({"_id": incident["_id"]}, {"$set": updates})
        normalized["updatedAtLocal"] = updates["updatedAtLocal"]
    return serialize(normalized)


@router.get("")
async def list_incidents(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    severity: str | None = None,
    triageStatus: str | None = None,
    search: str | None = None,
    sortBy: str = "severity",
    sortOrder: str = "desc",
    assignmentGroup: str | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    mongo_filter: dict = {}

    if severity:
        mongo_filter["severity"] = severity
    if triageStatus:
        statuses = status_filter_values(triageStatus)
        if len(statuses) == 1:
            mongo_filter["triageStatus"] = statuses[0]
        else:
            mongo_filter["triageStatus"] = {"$in": statuses}
    if assignmentGroup:
        mongo_filter["assignmentGroup"] = assignmentGroup
    if search:
        regex = {"$regex": search, "$options": "i"}
        mongo_filter["$or"] = [
            {"number": regex},
            {"shortDescription": regex},
            {"description": regex},
        ]

    if dateFrom or dateTo:
        opened_at: dict[str, datetime] = {}
        if dateFrom:
            opened_at["$gte"] = datetime.combine(datetime.fromisoformat(dateFrom).date(), time.min).astimezone(timezone.utc)
        if dateTo:
            opened_at["$lte"] = datetime.combine(datetime.fromisoformat(dateTo).date(), time.max).astimezone(timezone.utc)
        mongo_filter["openedAt"] = opened_at

    total = await db.incidents.count_documents(mongo_filter)

    sort_direction = -1 if sortOrder.lower() == "desc" else 1
    if sortBy == "severity":
        sort_fields = [("severityRank", sort_direction), ("openedAt", -1)]
    elif sortBy == "openedAt":
        sort_fields = [("openedAt", sort_direction)]
    elif sortBy == "updatedAt":
        sort_fields = [("updatedAt", sort_direction)]
    else:
        sort_fields = [("severityRank", -1), ("openedAt", -1)]

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

    update_doc["updatedAtLocal"] = datetime.now(timezone.utc)

    set_doc = {key: value for key, value in update_doc.items() if key != "$push"}
    update_ops: dict = {"$set": set_doc}
    if "$push" in update_doc:
        update_ops["$push"] = update_doc["$push"]

    await db.incidents.update_one({"_id": object_id}, update_ops)
    updated = await db.incidents.find_one({"_id": object_id})
    return serialize(updated)


@router.post("/sync")
async def sync_incidents(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    summary = await run_servicenow_sync(db)
    return {
        "new": summary["new"],
        "updated": summary["updated"],
        "unchanged": summary["unchanged"],
        "closed": summary["closed"],
    }
