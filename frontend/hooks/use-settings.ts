"use client";

import useSWR from "swr";
import apiClient from "@/lib/api-client";
import type { Agent, AppSettings } from "@/types/settings";

const fetcher = <T,>(url: string) => apiClient.get<T>(url);

export function useAppSettings() {
  return useSWR<AppSettings>("/api/settings", fetcher);
}

export function useKindoAgents() {
  return useSWR<Agent[]>("/api/kindo/agents", fetcher);
}

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  jobScheduled: boolean;
  nextRunAt: string | null;
  intervalMinutes: number | null;
}

export function useSchedulerStatus() {
  return useSWR<SchedulerStatus>("/api/cron/status", fetcher, { refreshInterval: 15000 });
}
