"""Helpers to normalize legacy incident triage payloads."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.models.incident import SEVERITY_RANK


_STATUS_ALIAS_MAP = {
    "for triage": "For Triage",
    "queued": "For Triage",
    "pending triage": "For Triage",
    "triage in progress": "Triage In Progress",
    "in progress": "Triage In Progress",
    "running": "Triage In Progress",
    "triage complete": "Triage Complete",
    "triage completed": "Triage Complete",
    "triaged": "Triage Complete",
    "completed": "Triage Complete",
    "success": "Triage Complete",
    "succeeded": "Triage Complete",
    "triage failed": "Triage Failed",
    "failed": "Triage Failed",
    "error": "Triage Failed",
    "remediation pending": "Remediation Pending",
    "resolved": "Resolved",
    "closed": "Closed",
}


def canonicalize_triage_status(raw_status: Any) -> str:
    if isinstance(raw_status, str):
        stripped = raw_status.strip()
        if not stripped:
            return "For Triage"
        return _STATUS_ALIAS_MAP.get(stripped.lower(), stripped)
    return "For Triage"


def status_filter_values(status: str) -> list[str]:
    canonical = canonicalize_triage_status(status)
    if canonical == "Triage Complete":
        return ["Triage Complete", "Triaged", "Triage Completed"]
    return [canonical]


def _coerce_string_list(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    return []


def _coerce_confidence(raw: Any) -> int:
    if isinstance(raw, bool):
        return 75
    if isinstance(raw, (int, float)):
        value = int(raw)
    elif isinstance(raw, str):
        digits = "".join(ch for ch in raw if ch.isdigit())
        value = int(digits) if digits else 75
    else:
        value = 75
    return max(0, min(100, value))


def _normalize_severity(raw_severity: Any) -> str | None:
    if not isinstance(raw_severity, str):
        return None
    normalized = raw_severity.strip().lower()
    if not normalized:
        return None
    if normalized.startswith("1") or normalized == "critical":
        return "Critical"
    if normalized.startswith("2") or normalized == "high":
        return "High"
    if normalized.startswith("3") or normalized == "medium" or normalized == "moderate":
        return "Medium"
    if normalized.startswith("4") or normalized == "low":
        return "Low"
    return None


def _severity_from_priority(raw_priority: Any) -> str | None:
    if raw_priority is None:
        return None
    normalized = str(raw_priority).strip().lower()
    if not normalized:
        return None
    if normalized.startswith("1") or "critical" in normalized:
        return "Critical"
    if normalized.startswith("2") or "high" in normalized:
        return "High"
    if normalized.startswith("3") or "moderate" in normalized or "medium" in normalized:
        return "Medium"
    if normalized.startswith("4") or "low" in normalized:
        return "Low"
    if normalized.startswith("5") or "planning" in normalized:
        return "Low"
    return None


def _legacy_triage_payload(incident: dict[str, Any]) -> dict[str, Any]:
    return {
        "agentNotes": incident.get("agentNotes"),
        "rootCauseHypothesis": incident.get("rootCauseHypothesis"),
        "riskNarrative": incident.get("riskNarrative"),
        "riskRating": incident.get("riskRating"),
        "iamIncidentType": incident.get("iamIncidentType"),
        "impactedSystems": incident.get("impactedSystems"),
        "complianceFlags": incident.get("complianceFlags"),
        "remediationPlan": incident.get("remediationPlan"),
        "triageAgent": incident.get("triageAgent"),
        "triageRunId": incident.get("triageRunId"),
        "triageCompletedAt": incident.get("triageCompletedAt"),
    }


def build_triage_results_from_legacy(incident: dict[str, Any]) -> dict[str, Any] | None:
    agent_notes = incident.get("agentNotes")
    root_cause = incident.get("rootCauseHypothesis")
    risk = incident.get("riskNarrative")
    incident_type = incident.get("iamIncidentType")
    run_id = incident.get("triageRunId")
    triage_agent = incident.get("triageAgent")
    impacted = _coerce_string_list(incident.get("impactedSystems"))
    completed_at = incident.get("triageCompletedAt")

    if not any([agent_notes, root_cause, risk, incident_type, run_id, triage_agent, impacted]):
        return None

    completed_at_value = (
        completed_at
        if isinstance(completed_at, str) and completed_at.strip()
        else datetime.now(timezone.utc).isoformat()
    )

    return {
        "summary": str(agent_notes or risk or incident.get("shortDescription") or "No summary returned"),
        "rootCauseAnalysis": str(root_cause or "Unknown"),
        "iamCategory": str(incident_type or incident.get("category") or "Other"),
        "iamSubCategory": str(incident.get("subcategory") or "General"),
        "affectedSystems": impacted,
        "impactAssessment": str(risk or agent_notes or "Impact not provided"),
        "confidenceScore": _coerce_confidence(incident.get("confidenceScore")),
        "triageAgent": str(triage_agent or "Kindo"),
        "kindoRunId": str(run_id or ""),
        "rawAgentOutput": json.dumps(_legacy_triage_payload(incident), default=str),
        "completedAt": completed_at_value,
    }


def build_remediation_steps_from_legacy(incident: dict[str, Any]) -> list[dict[str, Any]]:
    plan = incident.get("remediationPlan")
    if not isinstance(plan, dict):
        return []

    sections = [
        ("Immediate Action", plan.get("immediateActions"), 15),
        ("Short-Term Fix", plan.get("shortTermFix"), 20),
        ("Long-Term Fix", plan.get("longTermFix"), 30),
        ("Verification", plan.get("verificationSteps"), 10),
    ]

    steps: list[dict[str, Any]] = []
    step_number = 1
    for label, items, minutes in sections:
        if not isinstance(items, list):
            continue
        for item in items:
            action = str(item).strip()
            if not action:
                continue
            steps.append(
                {
                    "stepNumber": step_number,
                    "action": f"{label}: {action}",
                    "system": "General",
                    "commands": None,
                    "automatable": False,
                    "estimatedMinutes": minutes,
                    "status": "Pending",
                }
            )
            step_number += 1
    return steps


def normalize_incident_document(incident: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    normalized = dict(incident)
    updates: dict[str, Any] = {}

    severity = (
        _severity_from_priority(normalized.get("priority"))
        or _normalize_severity(normalized.get("severity"))
        or "Medium"
    )
    if normalized.get("severity") != severity:
        updates["severity"] = severity
        normalized["severity"] = severity
    expected_rank = SEVERITY_RANK[severity]
    if normalized.get("severityRank") != expected_rank:
        updates["severityRank"] = expected_rank
        normalized["severityRank"] = expected_rank

    canonical_status = canonicalize_triage_status(incident.get("triageStatus"))
    if canonical_status != incident.get("triageStatus"):
        updates["triageStatus"] = canonical_status
        normalized["triageStatus"] = canonical_status

    if not incident.get("triageResults"):
        triage_results = build_triage_results_from_legacy(incident)
        if triage_results:
            updates["triageResults"] = triage_results
            normalized["triageResults"] = triage_results

    if not incident.get("remediationSteps"):
        remediation_steps = build_remediation_steps_from_legacy(incident)
        if remediation_steps:
            updates["remediationSteps"] = remediation_steps
            normalized["remediationSteps"] = remediation_steps

    has_triage_payload = bool(normalized.get("triageResults")) or bool(normalized.get("remediationSteps"))
    if not has_triage_payload:
        has_triage_payload = bool(
            normalized.get("triageRunId")
            or normalized.get("triageCompletedAt")
            or normalized.get("triageAgent")
            or normalized.get("agentNotes")
            or normalized.get("rootCauseHypothesis")
            or normalized.get("remediationPlan")
        )

    current_status = normalized.get("triageStatus")
    if has_triage_payload and current_status in {"For Triage", "Triage In Progress"}:
        updates["triageStatus"] = "Triage Complete"
        normalized["triageStatus"] = "Triage Complete"
        current_status = "Triage Complete"

    if (
        current_status == "Triage Complete"
        and not normalized.get("triageCompletedAt")
        and isinstance(normalized.get("triageResults"), dict)
    ):
        completed_at = normalized["triageResults"].get("completedAt")
        if completed_at:
            updates["triageCompletedAt"] = completed_at
            normalized["triageCompletedAt"] = completed_at

    return normalized, updates
