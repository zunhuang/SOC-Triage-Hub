export type IncidentStatus =
  | "For Triage"
  | "Triage In Progress"
  | "Triage Complete"
  | "Triage Failed"
  | "Remediation Pending"
  | "Resolved"
  | "Closed";

export type Severity = "Critical" | "High" | "Medium" | "Low";

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
  summary: string;
  rootCauseAnalysis: string;
  iamCategory: string;
  iamSubCategory: string;
  affectedSystems: string[];
  impactAssessment: string;
  confidenceScore: number;
  triageAgent: string;
  kindoRunId: string;
  rawAgentOutput: string;
  completedAt: string;
}

export interface Incident {
  _id: string;
  snowIncidentId: string;
  number: string;
  shortDescription: string;
  description: string;
  severity: Severity;
  priority: string;
  state: string;
  assignmentGroup: string;
  assignedTo: string;
  caller: string;
  category: string;
  subcategory: string;
  configurationItem: string;
  openedAt: string;
  updatedAt: string;
  snowRawData: Record<string, unknown>;
  lastSyncedAt: string;
  syncHash: string;
  triageStatus: IncidentStatus;
  triageStartedAt?: string;
  triageCompletedAt?: string;
  triageResults?: TriageResults;
  remediationSteps?: RemediationStep[];
  activityLog: ActivityLogEntry[];
  createdAt: string;
  updatedAtLocal: string;
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
