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
    border: "border-[#DA291C]/30",
    bg: "bg-[#DA291C]/5",
    icon: "text-[#DA291C]",
    count: "text-[#DA291C]",
  },
  Medium: {
    border: "border-[#E8A317]/30",
    bg: "bg-[#E8A317]/5",
    icon: "text-[#E8A317]",
    count: "text-[#B07D12]",
  },
  Low: {
    border: "border-[#86BC25]/30",
    bg: "bg-[#F1F6E4]",
    icon: "text-[#86BC25]",
    count: "text-[#046A38]",
  },
  Lowest: {
    border: "border-[#00A3E0]/30",
    bg: "bg-[#00A3E0]/5",
    icon: "text-[#00A3E0]",
    count: "text-[#007AA8]",
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
