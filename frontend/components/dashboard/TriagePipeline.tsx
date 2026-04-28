"use client";

import { CheckCircle2, ClipboardList, LoaderCircle, Wrench } from "lucide-react";

interface TriagePipelineProps {
  counts: {
    "For Triage": number;
    "Triage In Progress": number;
    "Triage Complete": number;
    "Remediation Pending": number;
  };
  total: number;
}

const stages = [
  { key: "For Triage" as const, label: "For Triage", icon: ClipboardList, emptyMeta: "queue empty" },
  { key: "Triage In Progress" as const, label: "In Progress", icon: LoaderCircle, emptyMeta: "no active sessions" },
  { key: "Triage Complete" as const, label: "Triage Complete", icon: CheckCircle2, emptyMeta: "awaiting intake" },
  { key: "Remediation Pending" as const, label: "Remediation", icon: Wrench, emptyMeta: "no pending handoffs" },
];

export function TriagePipeline({ counts, total }: TriagePipelineProps) {
  const triaged = counts["Triage Complete"];
  const throughput = total > 0 ? Math.round((triaged / total) * 100) : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--dl-text-secondary)]">
        Triage Pipeline
        <span className="h-px flex-1 bg-gradient-to-r from-[#E6E6E6] to-transparent" />
      </div>

      <div className="relative overflow-hidden rounded-[10px] border border-[#E6E6E6] bg-white p-[22px_24px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Decorative concentric circles */}
        <div className="pointer-events-none absolute -right-[120px] -top-[120px] h-[280px] w-[280px] rounded-full border border-[rgba(134,188,37,0.18)]" />
        <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[160px] w-[160px] rounded-full border border-[rgba(0,163,224,0.12)]" />

        <div className="relative z-[1] mb-[18px] flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.10em] text-[var(--foreground)]">
            Triage Pipeline &middot; Last 24h
          </h3>
          <span className="text-xs text-[var(--dl-text-secondary)]">
            <strong className="font-bold text-[var(--foreground)]">{triaged}</strong> of{" "}
            <strong className="font-bold text-[var(--foreground)]">{total}</strong> incidents triaged &middot;{" "}
            {throughput}% throughput
          </span>
        </div>

        <div className="pipeline-stages relative z-[1] grid grid-cols-4">
          {stages.map((stage, idx) => {
            const count = counts[stage.key];
            const isZero = count === 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const Icon = stage.icon;
            const isLast = idx === stages.length - 1;

            return (
              <div
                key={stage.key}
                className={`pipeline-stage relative ${!isLast ? "border-r border-[#E6E6E6] pr-[22px]" : "pr-0"} ${idx > 0 ? "pl-[22px]" : "pl-0"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="grid h-[22px] w-[22px] place-items-center rounded-[5px] bg-[#F4F5F2] text-[var(--dl-text-secondary)]">
                    <Icon className="size-3" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--foreground)]">
                    {stage.label}
                  </span>
                </div>

                <div
                  className="mb-1.5 text-[28px] leading-none tabular-nums"
                  style={{
                    color: isZero ? "#BFBFBF" : "var(--dl-green-darker)",
                    fontWeight: isZero ? 300 : 600,
                  }}
                >
                  {count}
                </div>

                <div className="mb-1.5 h-1 overflow-hidden rounded-sm bg-[#EFEFEF]">
                  <div
                    className="h-full rounded-sm transition-[width] duration-400"
                    style={{
                      width: `${pct}%`,
                      background: isZero ? "#DADADA" : "#86BC25",
                    }}
                  />
                </div>

                <div className="text-[11px] text-[var(--dl-text-secondary)]">
                  {isZero ? (
                    stage.emptyMeta
                  ) : (
                    <>
                      <strong className="font-semibold text-[var(--foreground)]">{pct}%</strong> of intake
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
