"use client";

import { AlertCircle, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type PriorityBucket = "High+" | "Medium" | "Low" | "Lowest";

interface PriorityCardsProps {
  counts: Record<PriorityBucket, number>;
  selected?: PriorityBucket;
  onSelect: (bucket?: PriorityBucket) => void;
}

const sevConfig: Record<PriorityBucket, {
  accent: string;
  gradientFrom: string;
  iconBg: string;
  iconColor: string;
  countColor: string;
  sparkStroke: string;
}> = {
  "High+": {
    accent: "#DA291C",
    gradientFrom: "#FDEEEC",
    iconBg: "rgba(218,41,28,0.10)",
    iconColor: "#DA291C",
    countColor: "#DA291C",
    sparkStroke: "#DA291C",
  },
  Medium: {
    accent: "#D97706",
    gradientFrom: "#FEF4E6",
    iconBg: "rgba(217,119,6,0.10)",
    iconColor: "#D97706",
    countColor: "#D97706",
    sparkStroke: "#D97706",
  },
  Low: {
    accent: "#86BC25",
    gradientFrom: "#F1F8E5",
    iconBg: "rgba(134,188,37,0.14)",
    iconColor: "#6FA01E",
    countColor: "#6FA01E",
    sparkStroke: "#86BC25",
  },
  Lowest: {
    accent: "#00A3E0",
    gradientFrom: "#E5F6FC",
    iconBg: "rgba(0,163,224,0.10)",
    iconColor: "#005587",
    countColor: "#005587",
    sparkStroke: "#00A3E0",
  },
};

const iconMap: Record<PriorityBucket, typeof ShieldAlert> = {
  "High+": ShieldAlert,
  Medium: AlertTriangle,
  Low: AlertCircle,
  Lowest: ShieldCheck,
};

const BUCKETS: PriorityBucket[] = ["High+", "Medium", "Low", "Lowest"];

export type { PriorityBucket };

export function PriorityCards({ counts, selected, onSelect }: PriorityCardsProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--dl-text-secondary)]">
        By Severity
        <span className="h-px flex-1 bg-gradient-to-r from-[#E6E6E6] to-transparent" />
      </div>
      <div className="sev-grid-4 grid gap-4 grid-cols-2 xl:grid-cols-4">
        {BUCKETS.map((bucket) => {
          const Icon = iconMap[bucket];
          const cfg = sevConfig[bucket];
          const count = counts[bucket];
          const isZero = count === 0;
          const isActive = selected === bucket;

          return (
            <button
              key={bucket}
              onClick={() => onSelect(isActive ? undefined : bucket)}
              className={cn(
                "relative flex min-h-[138px] cursor-pointer flex-col overflow-hidden rounded-[10px] border border-[#E6E6E6] bg-white p-[18px_20px_16px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-[#D4D4D4] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]",
                isActive && "ring-2 ring-[#86BC25] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]"
              )}
              style={{
                background: `linear-gradient(180deg, ${cfg.gradientFrom} 0%, #FFFFFF 70%)`,
              }}
            >
              <div
                className="absolute left-0 top-0 h-full w-1"
                style={{ background: cfg.accent }}
              />

              <div className="flex items-start justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--foreground)]">
                  {bucket}
                </span>
                <div
                  className="grid h-7 w-7 place-items-center rounded-full"
                  style={{ background: cfg.iconBg }}
                >
                  <Icon className="size-3.5" style={{ color: cfg.iconColor }} />
                </div>
              </div>

              <div
                className="text-[38px] font-light leading-none tabular-nums my-1"
                style={{ color: isZero ? "#BFBFBF" : cfg.countColor, fontWeight: isZero ? 300 : 600 }}
              >
                {count}
              </div>

              <div className="mt-auto flex items-center gap-2 text-[11px] text-[var(--dl-text-secondary)]">
                <span className="inline-flex items-center gap-1 rounded bg-[#F0F0F0] px-1.5 py-0.5 font-semibold text-[var(--dl-text-secondary)]">
                  – 0
                </span>
                vs. last 24h
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
