"""Shared incident constants and helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, TypedDict


IncidentStatus = Literal[
    "For Triage",
    "Triage In Progress",
    "Triage Complete",
    "Triage Failed",
    "Remediation Pending",
    "Resolved",
    "Closed",
]

Severity = Literal["Critical", "High", "Medium", "Low"]

SEVERITY_RANK = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


class ActivityLog(TypedDict):
    timestamp: datetime
    action: str
    actor: str
    details: str


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
