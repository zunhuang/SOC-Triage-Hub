from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db
from app.services.activity_service import list_recent_activity
from app.utils.serialization import serialize

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("")
async def get_activity(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[dict]:
    rows = await list_recent_activity(db)
    serialized_rows = [serialize(row) for row in rows]
    response: list[dict] = []
    for row in serialized_rows:
        normalized = {**row}
        normalized["id"] = str(row.get("_id") or row.get("id") or "")
        response.append(normalized)
    return response
