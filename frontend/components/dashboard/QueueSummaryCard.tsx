"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useQueueStats } from "@/hooks/use-incidents";

interface QueueSummaryCardProps {
  queueType: string;
  label: string;
  href: string;
  accentColor: string;
  icon: LucideIcon;
}

interface StatRowProps {
  label: string;
  value: number;
  loading: boolean;
  highlight?: string;
}

function StatRow({ label, value, loading, highlight }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {loading ? (
        <div className="h-4 w-8 animate-pulse rounded bg-muted" />
      ) : (
        <span
          className="text-sm font-semibold tabular-nums"
          style={highlight && value > 0 ? { color: highlight } : undefined}
        >
          {value.toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function QueueSummaryCard({ queueType, label, href, accentColor, icon: Icon }: QueueSummaryCardProps) {
  const stats = useQueueStats(queueType);
  const loading = stats.total === 0 && stats.forTriage === 0 && stats.inProgress === 0;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 h-full w-[4px]" style={{ backgroundColor: accentColor }} />

      <div className="flex flex-col gap-3 px-5 py-4 pl-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" style={{ color: accentColor }} />
          <span className="text-sm font-semibold">{label}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-border/60" />

        {/* Stats */}
        <div className="divide-y divide-border/40">
          <StatRow label="For Triage" value={stats.forTriage} loading={loading} highlight="#F97316" />
          <StatRow label="In Progress" value={stats.inProgress} loading={loading} highlight="#3B82F6" />
          <StatRow label="Complete" value={stats.complete} loading={loading} highlight="#22C55E" />
          <StatRow label="Total" value={stats.total} loading={loading} />
        </div>

        {/* Footer link */}
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80 mt-1"
          style={{ color: accentColor }}
        >
          Open Queue
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
