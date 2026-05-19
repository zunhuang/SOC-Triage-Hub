"use client";

import useSWR from "swr";
import type { SWRConfiguration } from "swr";
import apiClient from "@/lib/api-client";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { Incident, IncidentListResponse, SyncSummary } from "@/types/incident";

const fetcher = <T,>(url: string) => apiClient.get<T>(url);

function shouldAutoRefresh(latest?: IncidentListResponse) {
  return latest?.data?.some(
    (incident) => canonicalizeTriageStatus(incident.triageStatus) === "Triage In Progress"
  )
    ? 5000
    : 0;
}

export function useIncidents(query: URLSearchParams, config?: SWRConfiguration<IncidentListResponse>) {
  return useSWR<IncidentListResponse>(`/api/incidents?${query.toString()}`, fetcher, {
    refreshInterval: shouldAutoRefresh,
    ...config
  });
}

export function useIncident(id: string, config?: SWRConfiguration<Incident>) {
  return useSWR<Incident>(id ? `/api/incidents/${id}` : null, fetcher, config);
}

export function useForTriageCount(queueType?: string) {
  const params = new URLSearchParams({ page: "1", limit: "1", triageStatus: "For Triage" });
  if (queueType) params.set("queueType", queueType);
  const { data } = useSWR<IncidentListResponse>(
    `/api/incidents?${params.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  return data?.pagination?.total ?? 0;
}

export function useQueueStats(queueType: string) {
  const makeParams = (status: string) => {
    const p = new URLSearchParams({ page: "1", limit: "1", queueType, triageStatus: status });
    return `/api/incidents?${p.toString()}`;
  };

  const { data: forTriage } = useSWR<IncidentListResponse>(makeParams("For Triage"), fetcher, { refreshInterval: 15000 });
  const { data: inProgress } = useSWR<IncidentListResponse>(makeParams("Triage In Progress"), fetcher, { refreshInterval: 10000 });
  const { data: complete } = useSWR<IncidentListResponse>(makeParams("Triage Complete"), fetcher, { refreshInterval: 30000 });
  const { data: all } = useSWR<IncidentListResponse>(
    `/api/incidents?${new URLSearchParams({ page: "1", limit: "1", queueType }).toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    forTriage: forTriage?.pagination?.total ?? 0,
    inProgress: inProgress?.pagination?.total ?? 0,
    complete: complete?.pagination?.total ?? 0,
    total: all?.pagination?.total ?? 0,
  };
}

export async function syncIncidents() {
  return apiClient.post<SyncSummary>("/api/incidents/sync");
}

export async function triggerTriage(incidentIds: string[], agentId?: string) {
  return apiClient.post<{ accepted: number }>("/api/kindo/triage", {
    incidentIds,
    agentId: agentId || undefined
  });
}

export async function deleteIncident(id: string) {
  return apiClient.delete<{ deleted: boolean; id: string }>(`/api/incidents/${id}`);
}

export async function postTriageToJira(id: string) {
  return apiClient.post<{ posted: boolean; jiraKey: string }>(`/api/incidents/${id}/post-to-jira`);
}

export async function addComment(id: string, text: string): Promise<void> {
  await apiClient.post(`/api/incidents/${id}/comments`, { text, actor: "Digital Analyst" });
}
