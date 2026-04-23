"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ClipboardList, LoaderCircle, RefreshCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { PriorityCards } from "@/components/dashboard/SeverityCards";
import type { PriorityBucket } from "@/components/dashboard/SeverityCards";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { useIncidents, syncIncidents } from "@/hooks/use-incidents";
import { useActivityFeed } from "@/hooks/use-activity";
import { ApiError } from "@/lib/api-client";
import { canonicalizeTriageStatus } from "@/lib/triage-status";

const STATUS_ICON_MAP = {
  "For Triage": ClipboardList,
  "Triage In Progress": LoaderCircle,
  "Triage Complete": CheckCircle2,
  "Remediation Pending": Wrench
} as const;

const priorityVariant: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  Highest: "destructive",
  High: "secondary",
  Medium: "outline",
  Low: "default",
  Lowest: "default"
};

function rankToBucket(rank: number): PriorityBucket | null {
  if (rank === 1 || rank === 2) return "High+";
  if (rank === 3) return "Medium";
  if (rank === 4) return "Low";
  if (rank === 5) return "Lowest";
  return null;
}

export default function DashboardPage() {
  const [selectedBucket, setSelectedBucket] = useState<PriorityBucket | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      limit: "8",
      sortBy: "priority",
      sortOrder: "desc"
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

  const counts = useMemo(() => {
    const base: Record<PriorityBucket, number> = {
      "High+": 0,
      Medium: 0,
      Low: 0,
      Lowest: 0
    };

    (data?.data ?? []).forEach((item) => {
      const bucket = rankToBucket(item.priorityRank);
      if (bucket) {
        base[bucket] += 1;
      }
    });
    return base;
  }, [data?.data]);

  const statusCounts = useMemo(() => {
    const base = {
      "For Triage": 0,
      "Triage In Progress": 0,
      "Triage Complete": 0,
      "Remediation Pending": 0
    };

    (data?.data ?? []).forEach((incident) => {
      const status = canonicalizeTriageStatus(incident.triageStatus);
      if (status in base) {
        base[status as keyof typeof base] += 1;
      }
    });

    return base;
  }, [data?.data]);

  async function handleSync() {
    setIsSyncing(true);
    setSyncStatus("");
    try {
      const summary = await syncIncidents();
      await mutate();
      setSyncStatus(
        `Sync complete: ${summary.new} new, ${summary.updated} updated, ${summary.unchanged} unchanged.`
      );
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
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Real-Time Operations Console</p>
          <h2 className="text-3xl font-semibold">Incident Triage Overview</h2>
          {syncStatus ? <p className="mt-2 text-sm text-muted-foreground">{syncStatus}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={isSyncing} variant="outline">
            <RefreshCcw className="mr-2 size-4" />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
          <Button asChild>
            <Link href="/incidents">Open Incident Workbench</Link>
          </Button>
        </div>
      </section>

      <PriorityCards counts={counts} selected={selectedBucket} onSelect={setSelectedBucket} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(statusCounts).map(([status, count]) => {
          const Icon = STATUS_ICON_MAP[status as keyof typeof STATUS_ICON_MAP];

          return (
            <Card key={status}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{status}</CardTitle>
                <Icon className={`size-4 text-muted-foreground ${status === "Triage In Progress" ? "animate-spin" : ""}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Highest-Priority Incident Preview</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/incidents">View Full Queue</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading incidents...</p>
          ) : (data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents available.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Triage Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((incident) => (
                  <TableRow key={incident._id}>
                    <TableCell className="font-medium">{incident.jiraKey}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{incident.summary}</TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[incident.priority] ?? "outline"}>{incident.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <TriageStatusBadge status={incident.triageStatus} />
                    </TableCell>
                    <TableCell>{format(new Date(incident.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/incidents/${incident._id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecentActivity entries={activity ?? []} />
    </div>
  );
}
