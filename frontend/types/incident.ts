export type IncidentStatus =
  | "For Triage"
  | "Triage In Progress"
  | "Triage Complete"
  | "Triage Failed"
  | "Remediation Pending"
  | "Resolved"
  | "Closed";

export type Priority = "Highest" | "High" | "Medium" | "Low" | "Lowest";

export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface RemediationStep {
  stepNumber: number;
  action: string;
  system: string;
  commands?: string;
  automatable: boolean;
  estimatedMinutes: number;
  status: "Pending" | "In Progress" | "Completed" | "Skipped";
}

export interface TriageResults {
  agentOutput: string;
  triageAgent: string;
  kindoRunId: string;
  completedAt: string;
}

export interface Incident {
  _id: string;
  jiraKey: string;
  jiraId: string;
  project: string;
  projectName: string;
  summary: string;
  status: string;
  priority: Priority | string;
  priorityRank: number;
  assignee: string | null;
  description: string;
  mxdrModule: string | null;
  triageStatus: IncidentStatus;
  triageStartedAt?: string;
  triageCompletedAt?: string;
  triageResults?: TriageResults;
  remediationSteps?: RemediationStep[];
  activityLog: ActivityLogEntry[];
  jiraRawData: unknown;
  syncHash: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string;
}

export interface IncidentListResponse {
  data: Incident[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SyncSummary {
  new: number;
  updated: number;
  unchanged: number;
  closed: number;
}

export interface ActivityFeedEntry {
  id: string;
  _id?: string;
  timestamp: string;
  incidentNumber?: string;
  action: string;
  message: string;
  actor: string;
  level: "info" | "warning" | "error";
}
