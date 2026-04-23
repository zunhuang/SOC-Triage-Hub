from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JiraSettingsPayload(BaseModel):
    baseUrl: str
    username: str
    password: str
    jql: str
    pollIntervalMinutes: int = Field(default=5, ge=1, le=60)


class KindoSettingsPayload(BaseModel):
    tenantUrl: str
    inferenceUrl: str
    apiKey: str


class AppSettingsPayload(BaseModel):
    llmProvider: Literal["openai", "anthropic", "gemini"]
    autoTriageEnabled: bool
    logLevel: Literal["debug", "info", "warning", "error"]
    pollIntervalMinutes: int = Field(default=5, ge=1, le=60)
    selectedTriageAgentId: str | None = None
    jira: JiraSettingsPayload
    kindo: KindoSettingsPayload
    updatedAt: datetime | None = None
