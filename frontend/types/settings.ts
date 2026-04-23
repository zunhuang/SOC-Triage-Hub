export interface ServiceNowSettings {
  instanceUrl: string;
  username: string;
  password: string;
  assignmentGroup: string;
  pollIntervalMinutes: number;
}

export interface KindoSettings {
  tenantUrl: string;
  inferenceUrl: string;
  apiKey: string;
}

export interface LlmSettings {
  provider: "openai" | "anthropic" | "gemini";
}

export interface AppSettings {
  _id?: string;
  llmProvider: "openai" | "anthropic" | "gemini";
  autoTriageEnabled: boolean;
  logLevel: "debug" | "info" | "warning" | "error";
  pollIntervalMinutes: number;
  selectedTriageAgentId?: string;
  serviceNow: ServiceNowSettings;
  kindo: KindoSettings;
  updatedAt: string;
}

export interface Agent {
  _id?: string;
  kindoAgentId: string;
  name: string;
  description: string;
  agentType: "chatbot" | "workflow" | "trigger" | "scheduled" | string;
  isActive: boolean;
  purpose: "triage" | "remediation" | "analysis" | "general";
  lastSyncedAt: string;
  createdAt?: string;
  updatedAt?: string;
  kindoMetadata?: Record<string, unknown>;
}
