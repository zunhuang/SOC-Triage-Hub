"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { Incident } from "@/types/incident";

export function TriagePanel({ incident }: { incident: Incident }) {
  const normalizedStatus = canonicalizeTriageStatus(incident.triageStatus);
  const triage = incident.triageResults;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Triage Analysis</span>
          <TriageStatusBadge status={normalizedStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!triage && (
          <p className="text-sm text-muted-foreground">
            No triage output yet for this incident. Launch triage to generate analysis and remediation recommendations.
          </p>
        )}

        {triage ? (
          <>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-4 text-sm leading-6">
              {triage.agentOutput}
            </pre>

            <details className="rounded-lg border bg-muted/20 p-4">
              <summary className="cursor-pointer text-sm font-medium">Run Metadata</summary>
              <div className="mt-3 grid gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Agent:</span> {triage.triageAgent || "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Run ID:</span>{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{triage.kindoRunId || "-"}</code>
                </p>
                <p>
                  <span className="text-muted-foreground">Completed:</span>{" "}
                  {triage.completedAt
                    ? `${format(new Date(triage.completedAt), "MMM d, yyyy HH:mm")} UTC`
                    : "-"}
                </p>
              </div>
            </details>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
