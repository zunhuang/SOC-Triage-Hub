"use client";

import { useState } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Crosshair, MessageSquare, Zap } from "lucide-react";
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

function getTitleAccent(summary: string): { lead: string; accent?: string } {
  const colonIdx = summary.lastIndexOf(":");
  if (colonIdx === -1 || summary.includes("_")) return { lead: summary };
  return { lead: summary.slice(0, colonIdx + 1), accent: summary.slice(colonIdx + 1).trim() };
}

export function TriagePanel({ incident }: { incident: Incident }) {
  const normalizedStatus = canonicalizeTriageStatus(incident.triageStatus);
  const triage = incident.triageResults;
  const displayText = triage?.agentOutput ? parseAgentOutput(triage.agentOutput) : "";
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState("");
  const [metaOpen, setMetaOpen] = useState(false);

  const titleParts = getTitleAccent(incident.summary);

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
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-[var(--dl-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--dl-border)] bg-gradient-to-b from-[#FAFBF8] to-white px-[22px] py-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-[6px] bg-[rgba(134,188,37,0.12)] text-[var(--dl-green-dark)]">
            <Crosshair className="size-3.5" />
          </div>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.10em] text-[var(--foreground)]">
            Cyber Digital Analyst &middot; Triage Analysis
          </h3>
        </div>
        <TriageStatusBadge status={normalizedStatus} />
      </div>

      {/* Empty state */}
      {!triage && (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#F4F5F2]">
            <Zap className="size-7 text-[#BFBFBF]" />
          </div>
          <p className="mb-2 text-[15px] font-semibold text-[var(--foreground)]">No triage analysis yet</p>
          <p className="mb-6 max-w-sm text-[13px] leading-relaxed text-[var(--dl-text-secondary)]">
            Launch an AI-powered triage to generate an investigation report with risk assessment and recommended actions.
          </p>
        </div>
      )}

      {/* Triage content */}
      {triage && (
        <>
          <div className="flex-1 overflow-y-auto px-[22px] py-5" style={{ maxHeight: "720px" }}>
            {/* Report title */}
            <h2 className="mb-5 text-[17px] font-light leading-snug tracking-[-0.01em] text-[var(--foreground)]">
              SOC Investigation Report &middot;{" "}
              <span className="font-mono text-[15px] font-semibold text-[#5A8217]">{incident.jiraKey}</span>
              <br />
              <span className="text-[16px]">
                {titleParts.lead}
                {titleParts.accent && (
                  <>
                    {" "}
                    <em className="font-bold not-italic text-[#86BC25]">{titleParts.accent}</em>
                  </>
                )}
              </span>
            </h2>

            {/* Markdown report */}
            <div className="triage-prose prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayText}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dl-border)] bg-[#FAFBF8] px-[22px] py-3.5">
            <div className="flex items-center gap-3 text-[11px] text-[var(--dl-text-secondary)]">
              {triage.completedAt && (
                <>
                  <span>
                    Run completed{" "}
                    <strong className="font-semibold text-[var(--foreground)]">
                      {format(new Date(triage.completedAt), "MMM d, yyyy HH:mm")}
                    </strong>
                  </span>
                  <span className="h-1 w-1 rounded-full bg-[#C0C0C0]" />
                </>
              )}
              {incident.triageStartedAt && triage.completedAt && (
                <>
                  <span>
                    <strong className="font-semibold text-[var(--foreground)]">
                      {Math.round(
                        (new Date(triage.completedAt).getTime() - new Date(incident.triageStartedAt).getTime()) / 60000 * 10
                      ) / 10}{" "}
                      min
                    </strong>{" "}
                    elapsed
                  </span>
                  <span className="h-1 w-1 rounded-full bg-[#C0C0C0]" />
                </>
              )}
              <span>
                Agent: <strong className="font-semibold text-[var(--foreground)]">{triage.triageAgent || "—"}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePostToJira}
                disabled={posting || !triage.agentOutput || normalizedStatus !== "Triage Complete"}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[#86BC25] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA01E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare className="size-3.5" />
                {posting ? "Posting..." : "Post to Jira"}
              </button>
            </div>
          </div>
          {postStatus && (
            <div className={`border-t border-[var(--dl-border)] px-[22px] py-2 text-[12px] ${postStatus.startsWith("Failed") ? "bg-[#FDEEEC] text-[#DA291C]" : "bg-[#F1F8E5] text-[#5A8217]"}`}>
              {postStatus}
            </div>
          )}

          {/* Run Metadata accordion */}
          <div className="border-t border-[var(--dl-border)]">
            <button
              onClick={() => setMetaOpen(!metaOpen)}
              className="flex w-full items-center gap-2.5 px-[22px] py-3.5 text-left text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[#FAFBF8]"
            >
              <ChevronRight className={`size-3.5 text-[var(--dl-text-secondary)] transition-transform ${metaOpen ? "rotate-90" : ""}`} />
              Run Metadata
              <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dl-text-secondary)]">
                Pipeline Telemetry
              </span>
            </button>
            {metaOpen && (
              <div className="border-t border-[var(--dl-border)] px-[22px] pb-5 pt-3.5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[var(--radius)] border border-[var(--dl-border)] bg-[#FAFBF8] px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dl-text-secondary)]">
                      Agent
                    </div>
                    <div className="truncate font-mono text-[12px] font-semibold text-[var(--foreground)]">
                      {triage.triageAgent || "—"}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius)] border border-[var(--dl-border)] bg-[#FAFBF8] px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dl-text-secondary)]">
                      Run ID
                    </div>
                    <div className="truncate font-mono text-[12px] font-semibold text-[var(--foreground)]">
                      {triage.kindoRunId || "—"}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius)] border border-[var(--dl-border)] bg-[#FAFBF8] px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dl-text-secondary)]">
                      Completed
                    </div>
                    <div className="truncate font-mono text-[12px] font-semibold text-[var(--foreground)]">
                      {triage.completedAt
                        ? format(new Date(triage.completedAt), "MMM d, yyyy HH:mm")
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
