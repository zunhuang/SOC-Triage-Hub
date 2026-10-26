"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChatDrawer } from "@/components/incidents/cda/ChatDrawer";
import { useAuth } from "@/contexts/auth-context";
import type { ChatHistory, RunContext } from "@/hooks/use-chat";
import apiClient from "@/lib/api-client";
import { VERDICT_LABELS } from "@/lib/verdicts";
import type { Incident } from "@/types/incident";

const SUGGESTIONS = [
  "Explain the evidence behind the conclusion.",
  "Evaluate alternative explanations.",
  "Assess the proposed remediation."
];

/** Whether a record can be investigated further: it has a triage run that finished successfully. */
export function canInvestigateFurther(incident: Incident): boolean {
  const status = incident.triageStatus;
  return !!incident.triageResults?.kindoRunId && status !== "Triage In Progress" && status !== "Triage Failed";
}

interface Props {
  incident: Incident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvestigateFurtherDrawer({ incident, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [runContext, setRunContext] = useState<RunContext | undefined>();

  async function addToNotes(text: string) {
    await apiClient.post(`/api/incidents/${incident._id}/comments`, {
      text: `Investigate Further: ${text}`,
      actor: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email : "Analyst"
    });
  }

  const verdictKey = incident.triageResults?.verdict;
  const verdictLabel = verdictKey ? (VERDICT_LABELS[verdictKey] ?? verdictKey) : null;

  const unavailable =
    runContext && !runContext.available
      ? runContext.inProgress
        ? "Triage is still running. Investigate Further opens once it completes."
        : "Run triage first. Investigate Further continues a completed triage run."
      : null;

  return (
    <ChatDrawer
      open={open}
      onOpenChange={onOpenChange}
      path={`/api/incidents/${incident._id}/chat`}
      title="Investigate Further"
      subtitle={`${incident.jiraKey}: ${incident.summary}`}
      banner={
        runContext?.runId ? (
          <>
            Continuing triage run {runContext.runId.slice(0, 8)}
            {runContext.completedAt ? `, completed ${format(new Date(runContext.completedAt), "MMM d, HH:mm")}` : ""}.
            Everyone on this incident sees this thread.
          </>
        ) : null
      }
      unavailableReason={unavailable}
      intro="Pick up where the triage agent left off."
      emptyContext={
        <>
          The report and evidence are already in context
          {verdictLabel ? <>, and the agent's verdict was <strong className="text-[#1B1B1A]">{verdictLabel}</strong></> : null}.
          It can use the agent's tools, such as CrowdStrike, so say what to look up.
        </>
      }
      suggestions={SUGGESTIONS}
      composerPlaceholder="Follow up on the investigation…"
      onAddToNotes={addToNotes}
      onHistory={(h: ChatHistory | undefined) => setRunContext(h?.runContext)}
    />
  );
}
