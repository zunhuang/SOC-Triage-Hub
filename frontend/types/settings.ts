export interface JiraSettings {
  baseUrl: string;
  username: string;
  password: string;
  jql: string;
  pollIntervalMinutes: number;
}

export interface QueueSettings {
  queueType: "soc_triage" | "threat_intel" | "threat_hunt" | "detection_eng";
  jql: string;
  pollIntervalMinutes: number;
  enableScheduler: boolean;
  autoTriageEnabled: boolean;
  autoPostToJira: boolean;
  agentId: string | null;
}

export interface KindoSettings {
  tenantUrl: string;
  inferenceUrl: string;
  apiKey: string;
}

export interface AzureSettings {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  enabled: boolean;
}

export interface LlmSettings {
  provider: "openai" | "anthropic" | "gemini";
}

export interface AppSettings {
  _id?: string;
  llmProvider: "openai" | "anthropic" | "gemini";
  // Legacy flat fields — kept for backward compat
  enableScheduler: boolean;
  autoTriageEnabled: boolean;
  autoPostToJira: boolean;
  logLevel: "debug" | "info" | "warning" | "error";
  pollIntervalMinutes: number;
  selectedTriageAgentId?: string;
  queues: QueueSettings[];
  jira: JiraSettings;
  kindo: KindoSettings;
  azure: AzureSettings;
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
