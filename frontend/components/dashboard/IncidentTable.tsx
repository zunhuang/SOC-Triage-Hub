"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { useKindoAgents } from "@/hooks/use-settings";
import { triggerTriage } from "@/hooks/use-incidents";
import type { Incident } from "@/types/incident";

interface IncidentTableProps {
  incidents: Incident[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onAfterLaunch?: () => Promise<unknown> | unknown;
}

const priorityVariant: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  Highest: "destructive",
  High: "secondary",
  Medium: "outline",
  Low: "default",
  Lowest: "default"
};

export function IncidentTable({
  incidents,
  selectedIds,
  onToggle,
  onToggleAll,
  allSelected,
  onAfterLaunch
}: IncidentTableProps) {
  const { data: agents } = useKindoAgents();
  const [launchIncident, setLaunchIncident] = useState<{ id: string; jiraKey: string } | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [launchStatus, setLaunchStatus] = useState<string>("");
  const [isLaunching, setIsLaunching] = useState(false);

  const enabledAgents = useMemo(
    () => (agents ?? []).filter((agent) => agent.isActive && (agent.agentType === "workflow" || agent.agentType === "chatbot")),
    [agents]
  );

  async function launchTriage() {
    if (!launchIncident || !selectedAgentId) {
      return;
    }
    setIsLaunching(true);
    setLaunchStatus("");
    try {
      await triggerTriage([launchIncident.id], selectedAgentId);
      setLaunchStatus(`Triage queued for ${launchIncident.jiraKey}. Status will update automatically.`);
      await onAfterLaunch?.();
      setLaunchIncident(null);
    } catch {
      setLaunchStatus("Failed to launch triage for this incident.");
    } finally {
      setIsLaunching(false);
    }
  }

  function openLaunchDialog(incidentId: string, jiraKey: string) {
    setLaunchIncident({ id: incidentId, jiraKey });
    setSelectedAgentId((current) => current || enabledAgents[0]?.kindoAgentId || "");
    setLaunchStatus("");
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="deloitte-table">
        <TableHeader>
          <TableRow className="border-none">
            <TableHead className="w-12">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="select all incidents" />
            </TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>MXDR Module</TableHead>
            <TableHead>Triage Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow key={incident._id} className="border-b border-[#E6E6E6]">
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(incident._id)}
                  onChange={() => onToggle(incident._id)}
                  aria-label={`select ${incident.jiraKey}`}
                />
              </TableCell>
              <TableCell className="font-semibold text-[#046A38]">{incident.jiraKey}</TableCell>
              <TableCell className="max-w-[280px] truncate">{incident.summary}</TableCell>
              <TableCell>
                <Badge variant={priorityVariant[incident.priority] ?? "outline"}>{incident.priority}</Badge>
              </TableCell>
              <TableCell>{incident.status}</TableCell>
              <TableCell>{incident.assignee ?? "-"}</TableCell>
              <TableCell>{incident.mxdrModule ?? "-"}</TableCell>
              <TableCell>
                <TriageStatusBadge status={incident.triageStatus} />
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openLaunchDialog(incident._id, incident.jiraKey)}>
                    Re-Triage
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/incidents/${incident._id}`}>Open</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={launchIncident !== null} onOpenChange={(open) => !open && setLaunchIncident(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Triage</DialogTitle>
            <DialogDescription>
              Run triage for {launchIncident?.jiraKey}. Pick the enabled Kindo agent to execute this run.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="triage-agent-select">Enabled Agent</label>
            <select
              id="triage-agent-select"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              disabled={enabledAgents.length === 0}
            >
              {enabledAgents.length === 0 ? (
                <option value="">No enabled agents available</option>
              ) : (
                enabledAgents.map((agent) => (
                  <option key={agent.kindoAgentId} value={agent.kindoAgentId}>
                    {agent.name || agent.kindoAgentId}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              Triage runs in the background and usually completes in 5-10 minutes.
            </p>
            {launchStatus ? <p className="text-sm text-muted-foreground">{launchStatus}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchIncident(null)}>
              Cancel
            </Button>
            <Button onClick={launchTriage} disabled={!selectedAgentId || enabledAgents.length === 0 || isLaunching}>
              {isLaunching ? "Launching..." : "Launch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
