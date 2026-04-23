from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class IncidentListQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    priority: str | None = None
    triageStatus: str | None = None
    search: str | None = None
    sortBy: str = "priority"
    sortOrder: Literal["asc", "desc"] = "desc"
    dateFrom: date | None = None
    dateTo: date | None = None


class IncidentPatchRequest(BaseModel):
    triageStatus: str | None = None
    state: str | None = None
    manualNotes: str | None = None
    remediationSteps: list[dict] | None = None


class SyncSummary(BaseModel):
    new: int
    updated: int
    unchanged: int
    closed: int
