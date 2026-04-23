"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
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

const severityVariant: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  Critical: "destructive",
  High: "secondary",
  Medium: "outline",
  Low: "default"
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
  const [launchIncident, setLaunchIncident] = useState<{ id: string; number: string } | null>(null);
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
      setLaunchStatus(`Triage queued for ${launchIncident.number}. Status will update automatically.`);
      await onAfterLaunch?.();
      setLaunchIncident(null);
    } catch {
      setLaunchStatus("Failed to launch triage for this incident.");
    } finally {
      setIsLaunching(false);
    }
  }

  function openLaunchDialog(incidentId: string, incidentNumber: string) {
    setLaunchIncident({ id: incidentId, number: incidentNumber });
    setSelectedAgentId((current) => current || enabledAgents[0]?.kindoAgentId || "");
    setLaunchStatus("");
  }

  return (
    <div className="rounded-xl border bg-card p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="select all incidents" />
            </TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Short Description</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Triage Status</TableHead>
            <TableHead>Opened</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow key={incident._id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(incident._id)}
                  onChange={() => onToggle(incident._id)}
                  aria-label={`select ${incident.number}`}
                />
              </TableCell>
              <TableCell className="font-medium">{incident.number}</TableCell>
              <TableCell className="max-w-[280px] truncate">{incident.shortDescription}</TableCell>
              <TableCell>
                <Badge variant={severityVariant[incident.severity] ?? "outline"}>{incident.severity}</Badge>
              </TableCell>
              <TableCell>{incident.priority}</TableCell>
              <TableCell>
                <TriageStatusBadge status={incident.triageStatus} />
              </TableCell>
              <TableCell>{format(new Date(incident.openedAt), "MMM d, yyyy HH:mm")}</TableCell>
              <TableCell>{format(new Date(incident.updatedAt), "MMM d, yyyy HH:mm")}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openLaunchDialog(incident._id, incident.number)}>
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
              Run triage for {launchIncident?.number}. Pick the enabled Kindo agent to execute this run.
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
