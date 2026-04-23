"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncidentTable } from "@/components/dashboard/IncidentTable";
import { triggerTriage, useIncidents } from "@/hooks/use-incidents";

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("");
  const [triageStatus, setTriageStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: "priority", sortOrder: "desc" });
    if (priority) params.set("priority", priority);
    if (triageStatus) params.set("triageStatus", triageStatus);
    if (search) params.set("search", search);
    return params;
  }, [page, search, priority, triageStatus]);

  const { data, isLoading, mutate } = useIncidents(query);

  async function handleBulkTriage() {
    await triggerTriage(selectedIds);
    setSelectedIds([]);
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Incidents Workbench</h2>
        <p className="text-sm text-muted-foreground">Filter, search, and launch triage for incidents.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Input placeholder="Search incidents" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-9 rounded-md border bg-background px-3" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All Priorities</option>
          <option value="Highest">Highest</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
          <option value="Lowest">Lowest</option>
        </select>
        <select className="h-9 rounded-md border bg-background px-3" value={triageStatus} onChange={(event) => setTriageStatus(event.target.value)}>
          <option value="">All Triage Statuses</option>
          <option value="For Triage">For Triage</option>
          <option value="Triage In Progress">Triage In Progress</option>
          <option value="Triage Complete">Triage Complete</option>
          <option value="Triage Failed">Triage Failed</option>
          <option value="Remediation Pending">Remediation Pending</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        <Button onClick={handleBulkTriage} disabled={selectedIds.length === 0}>Trigger Triage ({selectedIds.length})</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading incidents...</p>
      ) : (
        <IncidentTable
          incidents={data?.data ?? []}
          selectedIds={selectedIds}
          allSelected={selectedIds.length > 0 && selectedIds.length === (data?.data.length ?? 0)}
          onToggle={(id) =>
            setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
          }
          onToggleAll={() => {
            const ids = data?.data.map((incident) => incident._id) ?? [];
            setSelectedIds((current) => (current.length === ids.length ? [] : ids));
          }}
          onAfterLaunch={mutate}
        />
      )}

      <div className="flex items-center justify-between text-sm">
        <Button variant="outline" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1}>
          Previous
        </Button>
        <span>
          Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? 1}
        </span>
        <Button
          variant="outline"
          onClick={() => setPage((value) => value + 1)}
          disabled={page >= (data?.pagination.totalPages ?? 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
