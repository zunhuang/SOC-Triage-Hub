"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Download, Filter, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityCards } from "@/components/dashboard/SeverityCards";
import type { PriorityBucket } from "@/components/dashboard/SeverityCards";
import { TriagePipeline } from "@/components/dashboard/TriagePipeline";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { CyberAnalystCallout } from "@/components/dashboard/CyberAnalystCallout";
import { DetectionSourceMix } from "@/components/dashboard/DetectionSourceMix";
import { useIncidents, syncIncidents } from "@/hooks/use-incidents";
import { useActivityFeed } from "@/hooks/use-activity";
import { ApiError } from "@/lib/api-client";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import { deriveDetectionSource, groupByDetectionSource } from "@/lib/detection-source";

function rankToBucket(rank: number): PriorityBucket | null {
  if (rank === 1 || rank === 2) return "High+";
  if (rank === 3) return "Medium";
  if (rank === 4) return "Low";
  if (rank === 5) return "Lowest";
  return null;
}

const priorityPillStyle: Record<string, string> = {
  Highest: "border border-[rgba(218,41,28,0.2)] bg-[#FDEEEC] text-[#8B0F08]",
  High: "border border-[rgba(218,41,28,0.2)] bg-[#FDEEEC] text-[#8B0F08]",
  Medium: "border border-[rgba(217,119,6,0.2)] bg-[#FEF4E6] text-[#8B5400]",
  Low: "border border-[rgba(134,188,37,0.25)] bg-[#F1F8E5] text-[#5A8217]",
  Lowest: "border border-[rgba(0,163,224,0.25)] bg-[#E5F6FC] text-[#005587]",
};

const priorityDotColor: Record<string, string> = {
  Highest: "#DA291C",
  High: "#DA291C",
  Medium: "#D97706",
  Low: "#86BC25",
  Lowest: "#00A3E0",
};

export default function DashboardPage() {
  const [selectedBucket, setSelectedBucket] = useState<PriorityBucket | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      limit: "8",
      sortBy: "priority",
      sortOrder: "desc",
    });
    if (selectedBucket) {
      if (selectedBucket === "High+") {
        params.set("priority", "High");
      } else {
        params.set("priority", selectedBucket);
      }
    }
    return params;
  }, [selectedBucket]);

  const { data, mutate, isLoading } = useIncidents(query);
  const { data: activity } = useActivityFeed();

  const totalIncidents = data?.pagination?.total ?? 0;
  const incidents = data?.data ?? [];

  const counts = useMemo(() => {
    const base: Record<PriorityBucket, number> = { "High+": 0, Medium: 0, Low: 0, Lowest: 0 };
    incidents.forEach((item) => {
      const bucket = rankToBucket(item.priorityRank);
      if (bucket) base[bucket] += 1;
    });
    return base;
  }, [incidents]);

  const statusCounts = useMemo(() => {
    const base = { "For Triage": 0, "Triage In Progress": 0, "Triage Complete": 0, "Remediation Pending": 0 };
    incidents.forEach((incident) => {
      const status = canonicalizeTriageStatus(incident.triageStatus);
      if (status in base) {
        base[status as keyof typeof base] += 1;
      } else if (status === "Resolved" || status === "Closed") {
        base["Triage Complete"] += 1;
      }
    });
    return base;
  }, [incidents]);

  const detectionSources = useMemo(() => groupByDetectionSource(incidents), [incidents]);

  const autoTriagePct = useMemo(() => {
    const total = statusCounts["Triage Complete"] + statusCounts["For Triage"] + statusCounts["Triage In Progress"] + statusCounts["Remediation Pending"];
    return total > 0 ? Math.round((statusCounts["Triage Complete"] / total) * 100) : 0;
  }, [statusCounts]);

  async function handleSync() {
    setIsSyncing(true);
    setSyncStatus("");
    try {
      const summary = await syncIncidents();
      await mutate();
      setLastSyncTime(new Date());
      setSyncStatus(`Sync complete: ${summary.new} new, ${summary.updated} updated, ${summary.unchanged} unchanged.`);
    } catch (error) {
      if (error instanceof ApiError) {
        const reason =
          typeof error.details === "object" &&
          error.details !== null &&
          "reason" in error.details &&
          typeof (error.details as { reason?: unknown }).reason === "string"
            ? (error.details as { reason: string }).reason
            : undefined;
        setSyncStatus(`Sync failed: ${error.message}${reason ? ` (${reason})` : ""}`);
        return;
      }
      setSyncStatus("Sync failed: unexpected error.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* ===== Page Header ===== */}
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dl-text-secondary)]">
            <span className="h-0.5 w-6 bg-[#86BC25]" />
            Real-time Operations Console
          </div>
          <h1 className="text-[30px] font-light leading-tight tracking-[-0.01em] text-[var(--foreground)]">
            Incident <em className="font-bold not-italic text-[#86BC25]">Triage</em> Overview
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--dl-text-secondary)]">
            {totalIncidents} incidents in queue
            <span className="mx-2 text-[#C8C8C8]">&middot;</span>
            Last 24 hours
            <span className="mx-2 text-[#C8C8C8]">&middot;</span>
            {lastSyncTime
              ? `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
              : "Live"}
          </p>
          {syncStatus && <p className="mt-2 text-sm text-[var(--dl-text-secondary)]">{syncStatus}</p>}
        </div>

        <div className="flex gap-2.5">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            className="border-[var(--dl-border-strong)] bg-white text-[13px] font-semibold hover:border-[#B8B8B8] hover:bg-[#FAFAFA]"
          >
            <RefreshCcw className="mr-2 size-3.5" />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
          <Button asChild className="bg-[#86BC25] text-[13px] font-semibold text-white hover:bg-[#6FA01E]">
            <Link href="/incidents">
              Open Incident Workbench
              <ChevronRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ===== Severity Cards ===== */}
      <PriorityCards counts={counts} selected={selectedBucket} onSelect={setSelectedBucket} />

      {/* ===== Triage Pipeline ===== */}
      <TriagePipeline counts={statusCounts} total={totalIncidents} />

      {/* ===== Two-column: Queue Table + Insights ===== */}
      <div className="dashboard-two-col grid grid-cols-1 gap-5 xl:grid-cols-[3fr_1fr]">
        {/* Left: Incident Table */}
        <div className="min-w-0 overflow-hidden rounded-[10px] border border-[#E6E6E6] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#E6E6E6] px-[22px] py-[18px]">
            <div>
              <h3 className="text-[15px] font-bold tracking-[-0.005em] text-[var(--foreground)]">
                Highest-Priority Incident Preview
              </h3>
              <p className="mt-0.5 text-xs text-[var(--dl-text-secondary)]">
                Top {incidents.length} incidents ranked by severity and recency
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="grid h-8 w-8 place-items-center rounded-md border border-[#E6E6E6] bg-white text-[var(--dl-text-secondary)] transition-all hover:border-[#D4D4D4] hover:bg-[#FAFAFA] hover:text-[var(--foreground)]"
                title="Filter"
              >
                <Filter className="size-3.5" />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-md border border-[#E6E6E6] bg-white text-[var(--dl-text-secondary)] transition-all hover:border-[#D4D4D4] hover:bg-[#FAFAFA] hover:text-[var(--foreground)]"
                title="Export"
              >
                <Download className="size-3.5" />
              </button>
              <Link
                href="/incidents"
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-semibold text-[#6FA01E] transition-colors hover:bg-[rgba(134,188,37,0.08)]"
              >
                View Full Queue
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {isLoading ? (
            <p className="p-6 text-sm text-[var(--dl-text-secondary)]">Loading incidents...</p>
          ) : incidents.length === 0 ? (
            <p className="p-6 text-sm text-[var(--dl-text-secondary)]">No incidents available.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="queue-table w-full border-collapse">
              <thead>
                <tr>
                  <th className="pl-[22px] py-2.5 px-4 text-left">Key</th>
                  <th className="py-2.5 px-4 text-left">Summary</th>
                  <th className="py-2.5 px-4 text-left">Priority</th>
                  <th className="py-2.5 px-4 text-left">Triage Status</th>
                  <th className="py-2.5 px-4 text-left">Created</th>
                  <th className="py-2.5 px-4 pr-[22px] text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => {
                  const source = deriveDetectionSource(incident.summary);
                  const created = new Date(incident.createdAt);
                  return (
                    <tr key={incident._id}>
                      <td className="pl-[22px] py-3.5 px-4 font-mono text-xs font-medium text-[var(--foreground)]">
                        {incident.jiraKey}
                      </td>
                      <td className="max-w-[360px] truncate py-3.5 px-4 text-[var(--foreground)]">
                        {source && (
                          <span className="mr-2 inline-block rounded-[3px] bg-[#F0F0F0] px-[5px] py-px font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--dl-text-secondary)]">
                            {source.tag}
                          </span>
                        )}
                        {incident.summary}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-[5px] rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityPillStyle[incident.priority] ?? "bg-[#F0F0F0] text-[#6B6B6B]"}`}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: priorityDotColor[incident.priority] ?? "#999" }}
                          />
                          {incident.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <TriageStatusBadge status={incident.triageStatus} />
                      </td>
                      <td className="whitespace-nowrap py-3.5 px-4 font-mono text-xs tabular-nums text-[var(--dl-text-secondary)]">
                        {format(created, "MMM d, yyyy")}{" "}
                        <span className="text-[var(--foreground)]">{format(created, "HH:mm")}</span>
                      </td>
                      <td className="whitespace-nowrap py-3.5 px-4 pr-[22px] text-right">
                        <Link
                          href={`/incidents/${incident._id}`}
                          className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--dl-border-strong)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-all hover:border-[#86BC25] hover:bg-[#86BC25] hover:text-white"
                        >
                          Open
                          <ChevronRight className="size-[11px] transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Right: Insights Column */}
        <div className="flex flex-col gap-4">
          {detectionSources.length > 0 && <DetectionSourceMix sources={detectionSources} />}
          <CyberAnalystCallout autoTriagePct={autoTriagePct} />
        </div>
      </div>

      {/* ===== Recent Activity (kept below) ===== */}
      <RecentActivity entries={activity ?? []} />
    </div>
  );
}
