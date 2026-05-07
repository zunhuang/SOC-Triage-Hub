from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JiraSettingsPayload(BaseModel):
    baseUrl: str
    username: str
    password: str
    jql: str = ""
    pollIntervalMinutes: int = Field(default=5, ge=1, le=60)


class KindoSettingsPayload(BaseModel):
    tenantUrl: str
    inferenceUrl: str
    apiKey: str


class QueueSettingsPayload(BaseModel):
    queueType: Literal["soc_triage", "threat_intel", "threat_hunt", "detection_eng"]
    jql: str = ""
    pollIntervalMinutes: int = Field(default=5, ge=1, le=60)
    enableScheduler: bool = False
    autoTriageEnabled: bool = False
    autoPostToJira: bool = False
    agentId: str | None = None


class AppSettingsPayload(BaseModel):
    llmProvider: Literal["openai", "anthropic", "gemini"]
    # Legacy flat fields — kept as fallbacks if queues array is empty
    autoTriageEnabled: bool = False
    autoPostToJira: bool = False
    enableScheduler: bool = False
    logLevel: Literal["debug", "info", "warning", "error"] = "info"
    pollIntervalMinutes: int = Field(default=5, ge=1, le=60)
    selectedTriageAgentId: str | None = None
    queues: list[QueueSettingsPayload] = []
    jira: JiraSettingsPayload
    kindo: KindoSettingsPayload
    updatedAt: datetime | None = None
