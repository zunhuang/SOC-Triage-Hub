"use client";

import { AlertCircle, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PriorityBucket = "High+" | "Medium" | "Low" | "Lowest";

interface PriorityCardsProps {
  counts: Record<PriorityBucket, number>;
  selected?: PriorityBucket;
  onSelect: (bucket?: PriorityBucket) => void;
}

const toneMap: Record<PriorityBucket, { border: string; bg: string; icon: string; count: string }> = {
  "High+": {
    border: "border-red-600/30",
    bg: "bg-red-50",
    icon: "text-red-600",
    count: "text-red-700",
  },
  Medium: {
    border: "border-amber-500/30",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    count: "text-amber-700",
  },
  Low: {
    border: "border-[#86BC25]/30",
    bg: "bg-[#F1F6E4]",
    icon: "text-[#26890D]",
    count: "text-[#046A38]",
  },
  Lowest: {
    border: "border-[#0097A9]/30",
    bg: "bg-[#E6F7F9]",
    icon: "text-[#0097A9]",
    count: "text-[#007585]",
  },
};

const iconMap: Record<PriorityBucket, typeof ShieldAlert> = {
  "High+": ShieldAlert,
  Medium: AlertTriangle,
  Low: AlertCircle,
  Lowest: ShieldCheck
};

const BUCKETS: PriorityBucket[] = ["High+", "Medium", "Low", "Lowest"];

export type { PriorityBucket };

export function PriorityCards({ counts, selected, onSelect }: PriorityCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BUCKETS.map((bucket) => {
        const Icon = iconMap[bucket];
        const tone = toneMap[bucket];
        const isActive = selected === bucket;
        return (
          <button key={bucket} onClick={() => onSelect(isActive ? undefined : bucket)} className="text-left">
            <Card className={cn(
              "transition-all hover:shadow-md",
              tone.border,
              tone.bg,
              isActive && "ring-2 ring-[#86BC25] shadow-md"
            )}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-foreground/80">{bucket}</CardTitle>
                <Icon className={cn("size-5", tone.icon)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold tabular-nums", tone.count)}>{counts[bucket]}</div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
