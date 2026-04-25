"use client";

import { useState } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import { postTriageToJira } from "@/hooks/use-incidents";
import type { Incident } from "@/types/incident";

function parseAgentOutput(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.parts)) {
      const textParts = obj.parts
        .filter((p: { type?: string; text?: string }) => p.type === "text" && p.text?.trim())
        .map((p: { text: string }) => p.text.trim());
      if (textParts.length > 0) {
        return textParts[textParts.length - 1];
      }
    }
  } catch {
    // not JSON — use as-is
  }
  return raw;
}

export function TriagePanel({ incident }: { incident: Incident }) {
  const normalizedStatus = canonicalizeTriageStatus(incident.triageStatus);
  const triage = incident.triageResults;
  const displayText = triage?.agentOutput ? parseAgentOutput(triage.agentOutput) : "";
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState("");

  async function handlePostToJira() {
    setPosting(true);
    setPostStatus("");
    try {
      const result = await postTriageToJira(incident._id);
      setPostStatus(`Posted to ${result.jiraKey}`);
    } catch {
      setPostStatus("Failed to post to Jira");
    } finally {
      setPosting(false);
    }
  }

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
            <div className="prose prose-sm dark:prose-invert max-h-[70vh] max-w-none overflow-auto rounded-lg border bg-muted/20 p-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayText}
              </ReactMarkdown>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePostToJira}
                disabled={posting || !triage.agentOutput || normalizedStatus !== "Triage Complete"}
              >
                {posting ? "Posting..." : "Post to Jira"}
              </Button>
              {postStatus && (
                <span className={`text-sm ${postStatus.startsWith("Failed") ? "text-destructive" : "text-muted-foreground"}`}>
                  {postStatus}
                </span>
              )}
            </div>

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
