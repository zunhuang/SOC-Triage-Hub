import type { IncidentStatus } from "@/types/incident";

const STATUS_MAP: Record<string, IncidentStatus> = {
  "for triage": "For Triage",
  queued: "For Triage",
  "pending triage": "For Triage",
  "triage in progress": "Triage In Progress",
  "in progress": "Triage In Progress",
  running: "Triage In Progress",
  "triage complete": "Triage Complete",
  "triage completed": "Triage Complete",
  triaged: "Triage Complete",
  completed: "Triage Complete",
  success: "Triage Complete",
  succeeded: "Triage Complete",
  "triage failed": "Triage Failed",
  failed: "Triage Failed",
  error: "Triage Failed",
  "remediation pending": "Remediation Pending",
  resolved: "Resolved",
  closed: "Closed"
};

export function canonicalizeTriageStatus(status: string): IncidentStatus {
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return "For Triage";
  }
  return STATUS_MAP[normalized] ?? "For Triage";
}
