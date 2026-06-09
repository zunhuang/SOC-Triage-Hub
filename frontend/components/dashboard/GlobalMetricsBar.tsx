"use client";

import { useQueueStats } from "@/hooks/use-incidents";

interface MetricPillProps {
  label: string;
  value: number | null;
  accent?: string;
}

function MetricPill({ label, value, accent }: MetricPillProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-5 py-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {value === null ? (
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <span
          className="text-3xl font-light tabular-nums tracking-tight"
          style={accent ? { color: accent } : undefined}
        >
          {value.toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function GlobalMetricsBar() {
  const soc = useQueueStats("soc_triage");
  const intel = useQueueStats("threat_intel");
  const hunt = useQueueStats("threat_hunt");
  const det = useQueueStats("detection_eng");

  const isLoading = soc.total === 0 && intel.total === 0 && hunt.total === 0 && det.total === 0;

  const total = soc.total + intel.total + hunt.total + det.total;
  const forTriage = soc.forTriage + intel.forTriage + hunt.forTriage + det.forTriage;
  const inProgress = soc.inProgress + intel.inProgress + hunt.inProgress + det.inProgress;
  const complete = soc.complete + intel.complete + hunt.complete + det.complete;

  const nullIfLoading = (n: number) => (isLoading ? null : n);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricPill label="Total Incidents" value={nullIfLoading(total)} />
      <MetricPill label="For Triage" value={nullIfLoading(forTriage)} accent={forTriage > 0 ? "#F97316" : undefined} />
      <MetricPill label="In Progress" value={nullIfLoading(inProgress)} accent={inProgress > 0 ? "#3B82F6" : undefined} />
      <MetricPill label="Complete" value={nullIfLoading(complete)} accent={complete > 0 ? "#22C55E" : undefined} />
    </div>
  );
}
