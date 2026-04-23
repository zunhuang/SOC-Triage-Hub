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
import { SeverityCards } from "@/components/dashboard/SeverityCards";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { useIncidents, syncIncidents } from "@/hooks/use-incidents";
import { useActivityFeed } from "@/hooks/use-activity";
import { ApiError } from "@/lib/api-client";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { Severity } from "@/types/incident";

const STATUS_ICON_MAP = {
  "For Triage": ClipboardList,
  "Triage In Progress": LoaderCircle,
  "Triage Complete": CheckCircle2,
  "Remediation Pending": Wrench
} as const;

const severityVariant: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  Critical: "destructive",
  High: "secondary",
  Medium: "outline",
  Low: "default"
};

function severityFromPriority(priority: string | undefined): Severity | undefined {
  const normalized = (priority ?? "").trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("1") || normalized.includes("critical")) {
    return "Critical";
  }
  if (normalized.startsWith("2") || normalized.includes("high")) {
    return "High";
  }
  if (
    normalized.startsWith("3") ||
    normalized.includes("moderate") ||
    normalized.includes("medium")
  ) {
    return "Medium";
  }
  if (normalized.startsWith("4") || normalized.includes("low")) {
    return "Low";
  }
  if (normalized.startsWith("5") || normalized.includes("planning")) {
    return "Low";
  }
  return undefined;
}

export default function DashboardPage() {
  const [severity, setSeverity] = useState<Severity | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      limit: "8",
      sortBy: "severity",
      sortOrder: "desc"
    });
    if (severity) {
      params.set("severity", severity);
    }
    return params;
  }, [severity]);

  const { data, mutate, isLoading } = useIncidents(query);
  const { data: activity } = useActivityFeed();

  const counts = useMemo(() => {
    const base: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };

    (data?.data ?? []).forEach((item) => {
      const normalizedSeverity = severityFromPriority(item.priority) ?? item.severity;
      if (normalizedSeverity in base) {
        base[normalizedSeverity] += 1;
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

      <SeverityCards counts={counts} selected={severity} onSelect={setSeverity} />

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
                  <TableHead>Number</TableHead>
                  <TableHead>Short Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Triage Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((incident) => (
                  <TableRow key={incident._id}>
                    <TableCell className="font-medium">{incident.number}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{incident.shortDescription}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant[incident.severity] ?? "outline"}>{incident.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <TriageStatusBadge status={incident.triageStatus} />
                    </TableCell>
                    <TableCell>{format(new Date(incident.openedAt), "MMM d, yyyy HH:mm")}</TableCell>
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
