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

const toneMap: Record<PriorityBucket, string> = {
  "High+": "border-rose-500/40 bg-rose-500/5",
  Medium: "border-amber-500/40 bg-amber-500/5",
  Low: "border-yellow-500/40 bg-yellow-500/5",
  Lowest: "border-cyan-500/40 bg-cyan-500/5"
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
        const isActive = selected === bucket;
        return (
          <button key={bucket} onClick={() => onSelect(isActive ? undefined : bucket)} className="text-left">
            <Card className={cn("transition-colors hover:border-primary/60", toneMap[bucket], isActive && "ring-2 ring-primary/40")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{bucket}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{counts[bucket]}</div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
