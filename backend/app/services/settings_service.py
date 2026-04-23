"""Runtime settings persistence."""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings

DEFAULT_SETTINGS = {
    "llmProvider": settings.LLM_PROVIDER,
    "autoTriageEnabled": settings.AUTO_TRIAGE_ENABLED,
    "logLevel": settings.LOG_LEVEL,
    "pollIntervalMinutes": settings.JIRA_POLL_INTERVAL_MINUTES,
    "selectedTriageAgentId": None,
    "jira": {
        "baseUrl": str(settings.JIRA_BASE_URL).rstrip("/"),
        "username": settings.JIRA_USERNAME,
        "password": settings.JIRA_PASSWORD,
        "jql": settings.JIRA_JQL,
        "pollIntervalMinutes": settings.JIRA_POLL_INTERVAL_MINUTES,
    },
    "kindo": {
        "tenantUrl": str(settings.KINDO_API_BASE_URL).rstrip("/"),
        "inferenceUrl": str(settings.KINDO_INFERENCE_URL).rstrip("/"),
        "apiKey": settings.KINDO_API_KEY,
    },
}


async def get_settings(db: AsyncIOMotorDatabase) -> dict:
    current = await db.app_settings.find_one({"singleton": True})
    if current:
        merged = {**current}

        for key, value in DEFAULT_SETTINGS.items():
            if key not in merged:
                merged[key] = value

        for nested_key in ("jira", "kindo"):
            current_nested = merged.get(nested_key, {})
            merged_nested = {**DEFAULT_SETTINGS[nested_key], **current_nested}
            merged[nested_key] = merged_nested

        if merged != current:
            await db.app_settings.update_one(
                {"_id": current["_id"]},
                {"$set": {key: value for key, value in merged.items() if key != "_id"}},
            )

        return merged

    seed = {**DEFAULT_SETTINGS, "singleton": True, "updatedAt": datetime.now(timezone.utc)}
    await db.app_settings.insert_one(seed)
    return seed


async def upsert_settings(db: AsyncIOMotorDatabase, payload: dict) -> dict:
    payload["singleton"] = True
    payload["updatedAt"] = datetime.now(timezone.utc)
    await db.app_settings.update_one({"singleton": True}, {"$set": payload}, upsert=True)
    return await get_settings(db)
