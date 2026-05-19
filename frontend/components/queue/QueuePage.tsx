"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, LayoutDashboard, Briefcase, Settings2 } from "lucide-react";
import { mutate as globalMutate } from "swr";
import { IncidentTable } from "@/components/dashboard/IncidentTable";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { triggerTriage, useIncidents, useQueueStats } from "@/hooks/use-incidents";
import { useActivityFeed } from "@/hooks/use-activity";
import { useAppSettings, useKindoAgents, useQueueSchedulerStatus } from "@/hooks/use-settings";
import apiClient from "@/lib/api-client";
import type { QueueType } from "@/types/incident";
import type { QueueSettings } from "@/types/settings";

export interface QueueMeta {
  queueType: QueueType;
  accentColor: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  slogan: string;
  heroBadge: string;
  heroMottoPrefix: string;
  heroMottoAccent: string;
  heroMottoSuffix: string;
  heroStats: string;
  heroStrip: string;
}

type Tab = "dashboard" | "workbench" | "settings";

// ─── Hero Card ───────────────────────────────────────────────────────────────

function HeroCard({ meta }: { meta: QueueMeta }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1A1A1A] p-7 text-white">
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
        style={{ background: meta.accentColor }}
      />
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: meta.accentColor }}>
        {meta.heroBadge}
      </p>
      <p className="mb-5 text-[22px] font-light leading-snug">
        {meta.heroMottoPrefix}
        <strong style={{ color: meta.accentColor }}>{meta.heroMottoAccent}</strong>
        {meta.heroMottoSuffix}
      </p>
      <div className="mb-4 flex gap-6">
        {meta.heroStats.split("·").map((stat, i) => {
          const [val, ...rest] = stat.trim().split(" ");
          return (
            <div key={i}>
              <span className="text-[28px] font-light">{val}</span>
              <span className="ml-1.5 text-[13px] text-[#999]">{rest.join(" ")}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[#555]">{meta.heroStrip}</p>
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCards({ queueType, accentColor }: { queueType: QueueType; accentColor: string }) {
  const stats = useQueueStats(queueType);
  const cards = [
    { label: "For Triage", value: stats.forTriage, color: "#F97316" },
    { label: "In Progress", value: stats.inProgress, color: "#3B82F6" },
    { label: "Complete", value: stats.complete, color: "#22C55E" },
    { label: "Total", value: stats.total, color: accentColor },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-[10px] border border-[var(--dl-border)] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dl-text-secondary)]">
            {card.label}
          </p>
          <p className="text-3xl font-light" style={{ color: card.color }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ meta }: { meta: QueueMeta }) {
  const { data: activityData } = useActivityFeed();
  return (
    <div className="space-y-6">
      <HeroCard meta={meta} />
      <StatCards queueType={meta.queueType} accentColor={meta.accentColor} />
      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--dl-text-secondary)]">
          Recent Activity
        </h2>
        <RecentActivity entries={activityData?.slice(0, 8) ?? []} />
      </div>
    </div>
  );
}

// ─── Workbench Tab ────────────────────────────────────────────────────────────

function WorkbenchTab({ meta }: { meta: QueueMeta }) {
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("");
  const [triageStatus, setTriageStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: "createdAt", sortOrder: "desc", queueType: meta.queueType });
    if (priority) params.set("priority", priority);
    if (triageStatus) params.set("triageStatus", triageStatus);
    if (search) params.set("search", search);
    return params;
  }, [page, search, priority, triageStatus, meta.queueType]);

  const { data, isLoading, mutate } = useIncidents(query);
  const forTriageCount = data?.data.filter((inc) => inc.triageStatus === "For Triage").length ?? 0;

  async function handleBulkTriage() {
    await triggerTriage(selectedIds);
    setSelectedIds([]);
    await mutate();
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[var(--dl-text-secondary)]">
        {data?.pagination.total ?? 0} total incidents{forTriageCount > 0 ? ` · ${forTriageCount} awaiting triage` : ""}
      </p>

      <div className="rounded-[10px] border border-[var(--dl-border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#B0B0B0]" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-[var(--dl-border)] bg-white pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            />
          </div>
          <select
            className="h-9 rounded-md border border-[var(--dl-border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
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
            onChange={(e) => { setTriageStatus(e.target.value); setPage(1); }}
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading incidents...</p>
      ) : (
        <IncidentTable
          incidents={data?.data ?? []}
          selectedIds={selectedIds}
          allSelected={selectedIds.length > 0 && selectedIds.length === (data?.data.length ?? 0)}
          onToggle={(id) =>
            setSelectedIds((cur) => cur.includes(id) ? cur.filter((e) => e !== id) : [...cur, id])
          }
          onToggleAll={() => {
            const ids = data?.data.map((i) => i._id) ?? [];
            setSelectedIds((cur) => cur.length === ids.length ? [] : ids);
          }}
          onAfterLaunch={mutate}
        />
      )}

      <div className="flex items-center justify-between rounded-[10px] border border-[var(--dl-border)] bg-white px-5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => setPage((v) => Math.max(v - 1, 1))}
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
          onClick={() => setPage((v) => v + 1)}
          disabled={page >= (data?.pagination.totalPages ?? 1)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dl-border-strong)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Scheduler Status ────────────────────────────────────────────────────────

function useCountdown(nextRunAt: string | null): string {
  const [display, setDisplay] = useState("—");
  useEffect(() => {
    if (!nextRunAt) { setDisplay("—"); return; }
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(nextRunAt).getTime() - Date.now()) / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setDisplay(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRunAt]);
  return display;
}

function SchedulerStatusCard({ queueType, accentColor }: { queueType: QueueType; accentColor: string }) {
  const status = useQueueSchedulerStatus(queueType);
  const countdown = useCountdown(status?.nextRunAt ?? null);

  if (!status) return null;

  const isActive = status.enabled && status.jobScheduled;

  return (
    <div className="rounded-[12px] border border-[var(--dl-border)] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--dl-text-secondary)]">
          Scheduler Status
        </p>
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            isActive
              ? { background: "rgba(134,188,37,0.1)", color: "#5A8217" }
              : { background: "rgba(0,0,0,0.05)", color: "#888" }
          }
        >
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: isActive ? "#86BC25" : "#C0C0C0" }}
          />
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
      {isActive && status.nextRunAt ? (
        <div className="flex items-baseline gap-3">
          <div>
            <p className="text-[11px] text-[var(--dl-text-secondary)]">Next pull in</p>
            <p className="text-[26px] font-light leading-tight" style={{ color: accentColor }}>
              {countdown}
            </p>
          </div>
          <div className="ml-4">
            <p className="text-[11px] text-[var(--dl-text-secondary)]">Interval</p>
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              {status.intervalMinutes} min
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--dl-text-secondary)]">
          Enable the scheduler and save to start automated Jira pulls.
        </p>
      )}
    </div>
  );
}

// ─── Queue Settings Tab ───────────────────────────────────────────────────────

function QueueSettingsTab({ meta }: { meta: QueueMeta }) {
  const { data: appSettings, mutate: mutateSettings } = useAppSettings();
  const { data: agents } = useKindoAgents();

  const existing: QueueSettings | undefined = appSettings?.queues?.find(
    (q) => q.queueType === meta.queueType
  );

  const [jql, setJql] = useState(existing?.jql ?? "");
  const [pollInterval, setPollInterval] = useState(existing?.pollIntervalMinutes ?? 5);
  const [agentId, setAgentId] = useState<string>(existing?.agentId ?? "");
  const [enableScheduler, setEnableScheduler] = useState(existing?.enableScheduler ?? false);
  const [autoTriage, setAutoTriage] = useState(existing?.autoTriageEnabled ?? false);
  const [autoPost, setAutoPost] = useState(existing?.autoPostToJira ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync state when settings load
  useMemo(() => {
    if (existing) {
      setJql(existing.jql ?? "");
      setPollInterval(existing.pollIntervalMinutes ?? 5);
      setAgentId(existing.agentId ?? "");
      setEnableScheduler(existing.enableScheduler ?? false);
      setAutoTriage(existing.autoTriageEnabled ?? false);
      setAutoPost(existing.autoPostToJira ?? false);
    }
  }, [existing?.jql, existing?.pollIntervalMinutes, existing?.agentId, existing?.enableScheduler, existing?.autoTriageEnabled, existing?.autoPostToJira]);

  async function handleSave() {
    if (!appSettings) return;
    setSaving(true);
    try {
      const thisQueue: QueueSettings = {
        queueType: meta.queueType,
        jql,
        pollIntervalMinutes: pollInterval,
        agentId: agentId || null,
        enableScheduler,
        autoTriageEnabled: autoTriage,
        autoPostToJira: autoPost,
      };
      const otherQueues = (appSettings.queues ?? []).filter((q) => q.queueType !== meta.queueType);
      const updated = { ...appSettings, queues: [...otherQueues, thisQueue] };
      await apiClient.put("/api/settings", updated);
      await apiClient.post("/api/cron/apply");
      await mutateSettings();
      await globalMutate("/api/cron/status");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const toggle = (checked: boolean, setter: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => setter(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border-0 p-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#86BC25]/50 ${checked ? "bg-[#86BC25]" : "bg-[#D0D0D0]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <SchedulerStatusCard queueType={meta.queueType} accentColor={meta.accentColor} />
      <div className="rounded-[12px] border border-[var(--dl-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-[var(--dl-border)] px-6 py-4">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{meta.eyebrow}</p>
            <p className="text-[12px] text-[var(--dl-text-secondary)]">Queue configuration</p>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[var(--dl-text-secondary)]">
            <span>Scheduler</span>
            {toggle(enableScheduler, setEnableScheduler)}
          </div>
        </div>

        {/* Card body */}
        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--dl-text-secondary)]">
              JQL Query
            </label>
            <textarea
              rows={3}
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              placeholder={`project = MY_PROJECT AND issuetype = Incident AND created >= -24h`}
              className="w-full rounded-md border border-[var(--dl-border)] bg-[#FAFAFA] px-3 py-2 font-mono text-[12px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--dl-text-secondary)]">
                Poll Interval (min)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-[var(--dl-border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--dl-text-secondary)]">
                Triage Agent
              </label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--dl-border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/40"
              >
                <option value="">Auto-select</option>
                {(agents ?? [])
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <option key={a.kindoAgentId} value={a.kindoAgentId}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: "Auto-triage new incidents", value: autoTriage, setter: setAutoTriage },
              { label: "Auto-post results to Jira", value: autoPost, setter: setAutoPost },
            ].map(({ label, value, setter }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--foreground)]">{label}</span>
                {toggle(value, setter)}
              </div>
            ))}
          </div>
        </div>

        {/* Card footer */}
        <div className="flex items-center justify-end border-t border-[var(--dl-border)] px-6 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#86BC25] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA01E] disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main QueuePage ───────────────────────────────────────────────────────────

const TAB_ITEMS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "workbench", label: "Workbench", Icon: Briefcase },
  { id: "settings",  label: "Queue Settings", Icon: Settings2 },
];

export function QueuePage({ meta }: { meta: QueueMeta }) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <div
          className="mb-1.5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: "var(--dl-text-secondary)" }}
        >
          <span className="h-0.5 w-6" style={{ backgroundColor: meta.accentColor }} />
          {meta.eyebrow}
        </div>
        <h1 className="text-[28px] font-light leading-tight tracking-[-0.01em]">
          {meta.title} <em className="font-bold not-italic" style={{ color: meta.accentColor }}>{meta.titleAccent}</em>
        </h1>
        <p className="mt-1 text-[13px] text-[var(--dl-text-secondary)]">{meta.slogan}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-[10px] border border-[var(--dl-border)] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {TAB_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] py-2 text-[13px] font-semibold transition-all ${
              tab === id
                ? "bg-[#F5F5F5] text-[var(--foreground)] shadow-sm"
                : "text-[var(--dl-text-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "dashboard" && <DashboardTab meta={meta} />}
      {tab === "workbench" && <WorkbenchTab meta={meta} />}
      {tab === "settings" && <QueueSettingsTab meta={meta} />}
    </div>
  );
}
