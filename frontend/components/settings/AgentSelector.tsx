"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api-client";
import { useKindoAgents } from "@/hooks/use-settings";
import type { Agent } from "@/types/settings";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function AgentSelector() {
  const { data, mutate, isLoading } = useKindoAgents();
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const allAgents = useMemo(() => {
    const agents = data ?? [];
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) => (a.name || a.kindoAgentId).toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q)
    );
  }, [data, search]);
  const totalAgents = allAgents.length;
  const invocableCount = useMemo(
    () => allAgents.filter((agent) => agent.agentType === "workflow" || agent.agentType === "chatbot").length,
    [allAgents]
  );
  const totalPages = Math.max(1, Math.ceil(totalAgents / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pagedAgents = useMemo(() => allAgents.slice(pageStart, pageStart + pageSize), [allAgents, pageStart, pageSize]);

  async function toggleAgent(kindoAgentId: string, isActive: boolean) {
    setPendingAgentId(kindoAgentId);
    setActionStatus("");
    try {
      await apiClient.patch(`/api/kindo/agents/${kindoAgentId}`, { isActive: !isActive });
      await mutate();
      setActionStatus(`Agent ${isActive ? "disabled" : "enabled"} successfully.`);
    } catch {
      setActionStatus("Failed to update agent status.");
    } finally {
      setPendingAgentId(null);
    }
  }

  async function setAgentType(kindoAgentId: string, agentType: string) {
    setPendingAgentId(kindoAgentId);
    setActionStatus("");
    try {
      await apiClient.patch(`/api/kindo/agents/${kindoAgentId}`, { agentType });
      await mutate();
      setActionStatus(`Agent tagged as ${agentType}.`);
    } catch {
      setActionStatus("Failed to update agent type.");
    } finally {
      setPendingAgentId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Kindo Agents</CardTitle>
          <CardDescription className="mt-1">
            Fetch all available Kindo agents and enable the ones allowed for incident triage.
          </CardDescription>
          <p className="mt-1 text-xs text-muted-foreground">
            No required form fields on this page. Use <strong>Fetch Agents</strong>, then enable the desired agent.
          </p>
        </div>
        <Button onClick={() => mutate()} variant="outline">Fetch Agents</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading agents...</p>}
        {!isLoading && allAgents.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="h-9 w-64"
                />
                <p className="text-muted-foreground">
                  Showing <strong>{pageStart + 1}</strong>-<strong>{Math.min(pageStart + pageSize, totalAgents)}</strong> of{" "}
                  <strong>{totalAgents}</strong> agents (<strong>{invocableCount}</strong> invocable)
                </p>
              </div>
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows per page</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {actionStatus ? <p className="text-sm text-muted-foreground">{actionStatus}</p> : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-full">Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAgents.map((agent) => (
                  <TableRow
                    key={agent.kindoAgentId}
                    className="cursor-pointer"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <TableCell className="font-medium">{agent.name || agent.kindoAgentId}</TableCell>
                    <TableCell>
                      <Badge variant={agent.agentType === "workflow" ? "default" : "outline"}>{agent.agentType}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[40rem] whitespace-normal text-muted-foreground">
                      {agent.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={agent.isActive ? "default" : "secondary"}>
                        {agent.isActive ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedAgent(agent);
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          disabled={pendingAgentId === agent.kindoAgentId}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleAgent(agent.kindoAgentId, agent.isActive);
                          }}
                        >
                          {pendingAgentId === agent.kindoAgentId ? "Saving..." : agent.isActive ? "Disable" : "Enable"}
                        </Button>
                        {agent.agentType !== "scheduled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingAgentId === agent.kindoAgentId}
                            onClick={(event) => {
                              event.stopPropagation();
                              void setAgentType(agent.kindoAgentId, "scheduled");
                            }}
                          >
                            Mark Scheduled
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <p className="min-w-24 text-center text-sm text-muted-foreground">
                Page {safeCurrentPage} / {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        {!isLoading && allAgents.length === 0 && (
          <p className="text-sm text-muted-foreground">No agents found.</p>
        )}
      </CardContent>

      <Dialog open={selectedAgent !== null} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent className="max-h-[85vh] w-[min(96vw,64rem)] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAgent?.name || selectedAgent?.kindoAgentId || "Agent Details"}</DialogTitle>
            <DialogDescription>
              Detailed metadata for this Kindo agent.
            </DialogDescription>
          </DialogHeader>
          {selectedAgent ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm">
                <p className="min-w-0 break-words"><span className="font-medium">Agent ID:</span> {selectedAgent.kindoAgentId}</p>
                <p className="min-w-0 break-words"><span className="font-medium">Type:</span> {selectedAgent.agentType}</p>
                <p className="min-w-0 break-words"><span className="font-medium">Status:</span> {selectedAgent.isActive ? "Enabled" : "Disabled"}</p>
                <p className="min-w-0 break-words"><span className="font-medium">Purpose:</span> {selectedAgent.purpose}</p>
                <p className="min-w-0 break-words"><span className="font-medium">Last Synced:</span> {selectedAgent.lastSyncedAt || "N/A"}</p>
                <p className="min-w-0 break-words"><span className="font-medium">Created:</span> {selectedAgent.createdAt || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">{selectedAgent.description || "No description"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Raw Agent Metadata</p>
                <pre className="mt-1 max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selectedAgent.kindoMetadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
