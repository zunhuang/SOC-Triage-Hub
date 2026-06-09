"use client";

import { AlertTriangle, Shield, Search, Code2 } from "lucide-react";
import { GlobalMetricsBar } from "@/components/dashboard/GlobalMetricsBar";
import { QueueSummaryCard } from "@/components/dashboard/QueueSummaryCard";
import { TopPendingIncidents } from "@/components/dashboard/TopPendingIncidents";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useActivityFeed } from "@/hooks/use-activity";

const QUEUES = [
  { queueType: "soc_triage",    label: "SOC Triage",          href: "/soc-triage",    accentColor: "#86BC25", icon: AlertTriangle },
  { queueType: "threat_intel",  label: "Threat Intelligence", href: "/threat-intel",  accentColor: "#F59E0B", icon: Shield },
  { queueType: "threat_hunt",   label: "Threat Hunt",         href: "/threat-hunt",   accentColor: "#EF4444", icon: Search },
  { queueType: "detection_eng", label: "Detection Engineering", href: "/detection-eng", accentColor: "#6366F1", icon: Code2 },
] as const;

export default function DashboardPage() {
  const { data: activityEntries = [] } = useActivityFeed();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time view across all active work queues
        </p>
      </div>

      {/* Global metrics */}
      <GlobalMetricsBar />

      {/* Queue cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {QUEUES.map((q) => (
          <QueueSummaryCard
            key={q.queueType}
            queueType={q.queueType}
            label={q.label}
            href={q.href}
            accentColor={q.accentColor}
            icon={q.icon}
          />
        ))}
      </div>

      {/* Bottom split: top pending incidents + activity feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopPendingIncidents />
        </div>
        <div>
          <RecentActivity entries={activityEntries} />
        </div>
      </div>
    </div>
  );
}
