"use client";

import useSWR from "swr";
import apiClient from "@/lib/api-client";
import type { ActivityFeedEntry } from "@/types/incident";

const fetcher = <T,>(url: string) => apiClient.get<T>(url);

export function useActivityFeed() {
  return useSWR<ActivityFeedEntry[]>("/api/activity", fetcher, {
    refreshInterval: 15000
  });
}
