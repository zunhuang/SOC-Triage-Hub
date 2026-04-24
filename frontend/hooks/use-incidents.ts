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
