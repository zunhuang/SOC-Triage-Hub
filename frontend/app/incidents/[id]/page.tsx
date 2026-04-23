"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IncidentDetail } from "@/components/incidents/IncidentDetail";
import { TriagePanel } from "@/components/incidents/TriagePanel";
import apiClient from "@/lib/api-client";
import { triggerTriage, useIncident } from "@/hooks/use-incidents";
import { useKindoAgents } from "@/hooks/use-settings";
import { canonicalizeTriageStatus } from "@/lib/triage-status";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = params.id;
  const { data, isLoading, mutate } = useIncident(incidentId, {
    refreshInterval: (latest) => (canonicalizeTriageStatus(latest?.triageStatus ?? "") === "Triage In Progress" ? 5000 : 0)
  });
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

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading incident...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-[22rem] flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="incident-agent-picker">
              Triage Agent
            </label>
            <select
              id="incident-agent-picker"
              className="h-9 rounded-md border bg-background px-3 text-sm"
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
          </div>
          <Button variant="outline" onClick={launchTriageForIncident} disabled={!effectiveAgentId || isLaunching}>
            {isLaunching ? "Launching..." : "Re-Triage"}
          </Button>
        </div>
        <Button onClick={markResolved}>Mark Resolved</Button>
      </div>
      {launchStatus ? <p className="text-sm text-muted-foreground">{launchStatus}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <IncidentDetail incident={data} />
        <div className="space-y-4">
          <TriagePanel incident={data} />
        </div>
      </div>
    </div>
  );
}
