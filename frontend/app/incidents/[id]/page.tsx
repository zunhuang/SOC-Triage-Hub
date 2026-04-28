"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, ChevronRight, Clock, RefreshCcw, Trash2 } from "lucide-react";
import { IncidentDetail } from "@/components/incidents/IncidentDetail";
import { TriagePanel } from "@/components/incidents/TriagePanel";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import apiClient from "@/lib/api-client";
import { deleteIncident, triggerTriage, useIncident } from "@/hooks/use-incidents";
import { useKindoAgents } from "@/hooks/use-settings";
import { canonicalizeTriageStatus } from "@/lib/triage-status";

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

function getTitleAccent(summary: string): { lead: string; accent?: string } {
  const colonIdx = summary.lastIndexOf(":");
  if (colonIdx === -1 || summary.includes("_")) return { lead: summary };
  return { lead: summary.slice(0, colonIdx + 1), accent: summary.slice(colonIdx + 1).trim() };
}

const verdictConfig: Record<string, { borderColor: string; bgGradient: string; iconBg: string; labelExtra: string }> = {
  "Triage Complete": {
    borderColor: "rgba(134,188,37,0.25)",
    bgGradient: "linear-gradient(90deg, rgba(134,188,37,0.10) 0%, rgba(134,188,37,0.02) 100%)",
    iconBg: "#86BC25",
    labelExtra: "Triage Complete",
  },
  Resolved: {
    borderColor: "rgba(90,130,23,0.30)",
    bgGradient: "linear-gradient(90deg, rgba(90,130,23,0.10) 0%, rgba(90,130,23,0.02) 100%)",
    iconBg: "#5A8217",
    labelExtra: "Auto-Resolved",
  },
  Closed: {
    borderColor: "rgba(40,39,40,0.20)",
    bgGradient: "linear-gradient(90deg, rgba(40,39,40,0.06) 0%, rgba(40,39,40,0.01) 100%)",
    iconBg: "#282728",
    labelExtra: "Closed",
  },
  "Triage Failed": {
    borderColor: "rgba(218,41,28,0.25)",
    bgGradient: "linear-gradient(90deg, rgba(218,41,28,0.08) 0%, rgba(218,41,28,0.01) 100%)",
    iconBg: "#DA291C",
    labelExtra: "Triage Failed",
  },
};

const verdictLabel: Record<string, string> = {
  false_positive: "False Positive",
  benign_tp: "Benign True Positive",
  true_positive: "True Positive",
  needs_analyst: "Needs Analyst Review",
  inconclusive: "Inconclusive",
};

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = params.id;
  const { data, isLoading, mutate } = useIncident(incidentId, {
    refreshInterval: (latest) => (canonicalizeTriageStatus(latest?.triageStatus ?? "") === "Triage In Progress" ? 5000 : 0)
  });
  const router = useRouter();
  const { data: agents } = useKindoAgents();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [launchStatus, setLaunchStatus] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);

  const enabledAgents = useMemo(
    () => (agents ?? []).filter((agent) => agent.isActive && (agent.agentType === "workflow" || agent.agentType === "chatbot")),
    [agents]
  );
  const effectiveAgentId = selectedAgentId || enabledAgents[0]?.kindoAgentId || "";

  async function launchTriageForIncident() {
    if (!data) return;
    if (!effectiveAgentId) {
      setLaunchStatus("Enable at least one Kindo agent in Settings before launching triage.");
      return;
    }

    setIsLaunching(true);
    setLaunchStatus("");
    try {
      await triggerTriage([data._id], effectiveAgentId);
      setLaunchStatus("Triage run launched in background. Status will refresh automatically.");
      await mutate();
    } catch {
      setLaunchStatus("Failed to launch triage for this incident.");
    } finally {
      setIsLaunching(false);
    }
  }

  async function markResolved() {
    if (!data) return;
    await apiClient.patch(`/api/incidents/${data._id}`, { triageStatus: "Resolved", state: "Resolved" });
    await mutate();
  }

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm(`Delete incident ${data.jiraKey ?? data._id}? This cannot be undone.`)) return;
    await deleteIncident(data._id);
    router.push("/incidents");
  }

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading incident...</p>;
  }

  const normalizedStatus = canonicalizeTriageStatus(data.triageStatus);
  const titleParts = getTitleAccent(data.summary);
  const verdict = verdictConfig[normalizedStatus];
  const showVerdictBanner = !!verdict && !!data.triageResults;
  const selectedAgentName = enabledAgents.find((a) => a.kindoAgentId === effectiveAgentId)?.name;

  let elapsedMin: number | null = null;
  if (data.triageStartedAt && data.triageResults?.completedAt) {
    elapsedMin =
      Math.round(
        ((new Date(data.triageResults.completedAt).getTime() - new Date(data.triageStartedAt).getTime()) / 60000) * 10
      ) / 10;
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-[var(--dl-text-secondary)]">
        <Link href="/" className="transition-colors hover:text-[var(--dl-green-dark)]">Dashboard</Link>
        <ChevronRight className="size-3 text-[#C0C0C0]" />
        <Link href="/incidents" className="transition-colors hover:text-[var(--dl-green-dark)]">Incidents</Link>
        <ChevronRight className="size-3 text-[#C0C0C0]" />
        <span className="font-mono font-semibold text-[var(--foreground)]">{data.jiraKey}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-[320px] flex-1">
          <div className="mb-1.5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dl-text-secondary)]">
            <span className="h-0.5 w-6 bg-[#86BC25]" />
            Incident Detail
          </div>
          <div className="mb-2 flex flex-wrap items-baseline gap-3.5">
            <span className="font-mono text-[22px] font-semibold text-[var(--dl-text-secondary)]">
              {data.jiraKey}
            </span>
            <h1 className="text-[24px] font-light leading-tight tracking-[-0.01em]">
              {titleParts.lead}
              {titleParts.accent && (
                <>
                  {" "}
                  <em className="font-bold not-italic text-[#86BC25]">{titleParts.accent}</em>
                </>
              )}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--dl-text-secondary)]">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityPillStyle[data.priority] ?? "bg-[#F0F0F0] text-[#6B6B6B]"}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: priorityDotColor[data.priority] ?? "#999" }}
              />
              {data.priority}
            </span>
            <span className="text-[#C8C8C8]">&middot;</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3" />
              Created <strong className="font-semibold text-[var(--foreground)]">{format(new Date(data.createdAt), "MMM d, yyyy HH:mm")}</strong>
            </span>
            <span className="text-[#C8C8C8]">&middot;</span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCcw className="size-3" />
              Updated <strong className="font-semibold text-[var(--foreground)]">{format(new Date(data.updatedAt), "HH:mm")}</strong>
            </span>
            <span className="text-[#C8C8C8]">&middot;</span>
            <span className="inline-flex items-center gap-1.5">
              <strong className="font-semibold text-[var(--foreground)]">{data.project}</strong> — {data.projectName}
            </span>
          </div>
        </div>

        {/* Action cluster */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dl-border)] bg-white px-3.5 py-[7px] text-[12px] transition-colors hover:border-[var(--dl-border-strong)]"
            onClick={() => {
              const el = document.getElementById("incident-agent-picker");
              if (el) el.focus();
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--dl-text-secondary)]">Agent</span>
            <select
              id="incident-agent-picker"
              className="max-w-[180px] cursor-pointer truncate border-none bg-transparent text-[12px] font-semibold text-[var(--foreground)] outline-none"
              value={effectiveAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              disabled={enabledAgents.length === 0 || isLaunching}
            >
              {enabledAgents.length === 0 ? (
                <option value="">No enabled agents</option>
              ) : (
                enabledAgents.map((agent) => (
                  <option key={agent.kindoAgentId} value={agent.kindoAgentId}>
                    {agent.name || agent.kindoAgentId}
                  </option>
                ))
              )}
            </select>
          </button>

          <button
            onClick={launchTriageForIncident}
            disabled={!effectiveAgentId || isLaunching}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--dl-border-strong)] bg-white px-4 py-[9px] text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw className="size-3.5" />
            {isLaunching ? "Launching..." : "Re-Triage"}
          </button>

          <button
            onClick={markResolved}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[#86BC25] px-4 py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA01E]"
          >
            <Check className="size-3.5" />
            Mark Resolved
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center rounded-[var(--radius)] border border-[rgba(218,41,28,0.3)] bg-white px-3 py-[9px] text-[#DA291C] transition-all hover:border-[#DA291C] hover:bg-[#DA291C] hover:text-white"
            title="Delete incident"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Launch status message */}
      {launchStatus && <p className="text-sm text-muted-foreground">{launchStatus}</p>}

      {/* Verdict banner */}
      {showVerdictBanner && verdict && (
        <div
          className="relative flex items-center gap-[18px] overflow-hidden rounded-[10px] border-l-4 px-[22px] py-4"
          style={{
            background: verdict.bgGradient,
            borderColor: verdict.iconBg,
            borderTop: `1px solid ${verdict.borderColor}`,
            borderRight: `1px solid ${verdict.borderColor}`,
            borderBottom: `1px solid ${verdict.borderColor}`,
          }}
        >
          <div
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-white"
            style={{ background: verdict.iconBg }}
          >
            <Check className="size-[22px]" />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: verdict.iconBg }}>
              Triage Verdict &middot; {verdict.labelExtra}
            </div>
            <div className="text-[18px] font-bold" style={{ color: verdict.iconBg }}>
              {data.triageResults?.verdict
                ? verdictLabel[data.triageResults.verdict] ?? data.triageResults.verdict
                : normalizedStatus}
            </div>
            <div className="text-[12px] text-[var(--dl-text-secondary)]">
              AI triage completed &middot; See full analysis below
            </div>
          </div>
          {elapsedMin !== null && (
            <div className="flex-shrink-0 text-right text-[11px] text-[var(--dl-text-secondary)]">
              <strong className="block text-[13px] font-semibold text-[var(--foreground)]">{elapsedMin} min</strong>
              time to triage
            </div>
          )}
        </div>
      )}

      {/* Two-column detail */}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.7fr] [&>*]:min-w-0">
        <IncidentDetail incident={data} />
        <TriagePanel incident={data} />
      </div>
    </div>
  );
}
