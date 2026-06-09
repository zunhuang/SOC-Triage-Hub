"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncidents } from "@/hooks/use-incidents";
import type { Incident, QueueType } from "@/types/incident";

const QUEUE_LABELS: Record<QueueType, { label: string; color: string }> = {
  soc_triage:    { label: "SOC Triage",   color: "#86BC25" },
  threat_intel:  { label: "Threat Intel", color: "#F59E0B" },
  threat_hunt:   { label: "Threat Hunt",  color: "#EF4444" },
  detection_eng: { label: "Detect. Eng",  color: "#6366F1" },
};

const PRIORITY_COLOR: Record<string, string> = {
  Highest: "#DC2626",
  High: "#F97316",
  Medium: "#EAB308",
  Low: "#6B7280",
  Lowest: "#9CA3AF",
};

function QueueBadge({ queueType }: { queueType?: QueueType }) {
  const meta = queueType ? QUEUE_LABELS[queueType] : null;
  if (!meta) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const age = formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true });
  const priorityColor = PRIORITY_COLOR[incident.priority] ?? "#6B7280";

  return (
    <Link
      href={`/incidents/${incident._id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      <span className="w-24 shrink-0 text-xs font-mono font-medium text-foreground">{incident.jiraKey}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{incident.summary}</span>
      <QueueBadge queueType={incident.queueType} />
      <span className="w-16 shrink-0 text-right text-xs font-semibold" style={{ color: priorityColor }}>
        {incident.priority}
      </span>
      <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">{age}</span>
    </Link>
  );
}

export function TopPendingIncidents() {
  const params = useMemo(
    () => new URLSearchParams({ triageStatus: "For Triage", sortBy: "priority", limit: "8" }),
    []
  );
  const { data, isLoading } = useIncidents(params, { refreshInterval: 30000 });

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Needs Attention</CardTitle>
        <p className="text-xs text-muted-foreground">
          Highest-priority incidents awaiting triage across all queues
        </p>
      </CardHeader>
      <CardContent className="p-2">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 pb-1">
          <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Key</span>
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</span>
          <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Queue</span>
          <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</span>
          <span className="w-20 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Age</span>
        </div>

        {isLoading && (
          <div className="space-y-1 px-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (!data?.data || data.data.length === 0) && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No incidents awaiting triage
          </p>
        )}

        {!isLoading && data?.data && data.data.length > 0 && (
          <div className="space-y-0.5">
            {data.data.map((incident) => (
              <IncidentRow key={incident._id} incident={incident} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
