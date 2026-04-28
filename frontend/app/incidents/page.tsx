"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { IncidentTable } from "@/components/dashboard/IncidentTable";
import { triggerTriage, useIncidents } from "@/hooks/use-incidents";

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("");
  const [triageStatus, setTriageStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: "createdAt", sortOrder: "desc" });
    if (priority) params.set("priority", priority);
    if (triageStatus) params.set("triageStatus", triageStatus);
    if (search) params.set("search", search);
    return params;
  }, [page, search, priority, triageStatus]);

  const { data, isLoading, mutate } = useIncidents(query);

  const totalIncidents = data?.pagination.total ?? 0;
  const forTriageCount = data?.data.filter((inc) => inc.triageStatus === "For Triage").length ?? 0;

  async function handleBulkTriage() {
    await triggerTriage(selectedIds);
    setSelectedIds([]);
    await mutate();
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <div className="mb-1.5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dl-text-secondary)]">
          <span className="h-0.5 w-6 bg-[#86BC25]" />
          Incident Management
        </div>
        <h1 className="text-[28px] font-light leading-tight tracking-[-0.01em]">
          Incidents <em className="font-bold not-italic text-[#86BC25]">Workbench</em>
        </h1>
        <p className="mt-1 text-[13px] text-[var(--dl-text-secondary)]">
          {totalIncidents} total incidents{forTriageCount > 0 ? ` · ${forTriageCount} awaiting triage` : ""}
        </p>
      </div>

      {/* Filter panel */}
      <div className="rounded-[10px] border border-[var(--dl-border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#B0B0B0]" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-[var(--dl-border)] bg-white pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            />
          </div>
          <select
            className="h-9 rounded-md border border-[var(--dl-border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            value={priority}
            onChange={(event) => { setPriority(event.target.value); setPage(1); }}
          >
            <option value="">All Priorities</option>
            <option value="Highest">Highest</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Lowest">Lowest</option>
          </select>
          <select
            className="h-9 rounded-md border border-[var(--dl-border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            value={triageStatus}
            onChange={(event) => { setTriageStatus(event.target.value); setPage(1); }}
          >
            <option value="">All Triage Statuses</option>
            <option value="For Triage">For Triage</option>
            <option value="Triage In Progress">Triage In Progress</option>
            <option value="Triage Complete">Triage Complete</option>
            <option value="Triage Failed">Triage Failed</option>
            <option value="Remediation Pending">Remediation Pending</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <button
            onClick={handleBulkTriage}
            disabled={selectedIds.length === 0}
            className="h-9 rounded-md bg-[#86BC25] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA01E] disabled:cursor-not-allowed disabled:bg-[#E6E6E6] disabled:text-[#999]"
          >
            Trigger Triage ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Table */}
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

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-[10px] border border-[var(--dl-border)] bg-white px-5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => setPage((value) => Math.max(value - 1, 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dl-border-strong)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-[13px] text-[var(--dl-text-secondary)]">
          Page <strong className="font-semibold text-[var(--foreground)]">{data?.pagination.page ?? page}</strong> of{" "}
          <strong className="font-semibold text-[var(--foreground)]">{data?.pagination.totalPages ?? 1}</strong>
        </span>
        <button
          onClick={() => setPage((value) => value + 1)}
          disabled={page >= (data?.pagination.totalPages ?? 1)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dl-border-strong)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
