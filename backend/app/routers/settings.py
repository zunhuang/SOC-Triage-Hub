from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db
from app.schemas.settings import AppSettingsPayload
from app.services.settings_service import get_settings, upsert_settings
from app.utils.serialization import serialize

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def read_settings(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    current = await get_settings(db)
    return serialize(current)


@router.put("")
async def update_settings(payload: AppSettingsPayload, db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    updated = await upsert_settings(db, payload.model_dump())
    return serialize(updated)
