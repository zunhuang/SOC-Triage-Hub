from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_db
from app.services.jira_client import JiraClient
from app.services.settings_service import get_settings

router = APIRouter(prefix="/api/jira", tags=["jira"])


class JiraTestRequest(BaseModel):
    baseUrl: str
    username: str
    password: str


@router.post("/test")
async def test_jira_connection(
    payload: JiraTestRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    runtime_settings = await get_settings(db)
    client = JiraClient.from_settings(runtime_settings)
    return await client.test_connection(
        base_url=payload.baseUrl,
        username=payload.username,
        password=payload.password,
    )
