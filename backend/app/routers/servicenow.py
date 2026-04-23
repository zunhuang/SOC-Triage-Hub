from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db
from app.services.servicenow_client import ServiceNowClient
from app.services.settings_service import get_settings

router = APIRouter(prefix="/api/servicenow", tags=["servicenow"])


@router.post("/test")
async def test_servicenow_connection(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    runtime_settings = await get_settings(db)
    client = ServiceNowClient.from_settings(runtime_settings)
    return await client.test_connection()
