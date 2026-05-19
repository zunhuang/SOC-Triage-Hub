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

export interface QueueSchedulerStatus {
  queueType: string;
  enabled: boolean;
  jobScheduled: boolean;
  nextRunAt: string | null;
  intervalMinutes: number;
}

export interface SchedulerStatus {
  mode?: "per_queue" | "legacy";
  enabled: boolean;
  running: boolean;
  jobScheduled: boolean;
  nextRunAt: string | null;
  intervalMinutes: number | null;
  queues?: QueueSchedulerStatus[];
}

export function useSchedulerStatus() {
  return useSWR<SchedulerStatus>("/api/cron/status", fetcher, { refreshInterval: 15000 });
}

export function useQueueSchedulerStatus(queueType: string): QueueSchedulerStatus | null {
  const { data } = useSWR<SchedulerStatus>("/api/cron/status", fetcher, { refreshInterval: 15000 });
  if (!data) return null;
  if (data.mode === "per_queue" && data.queues) {
    return data.queues.find((q) => q.queueType === queueType) ?? null;
  }
  return null;
}
