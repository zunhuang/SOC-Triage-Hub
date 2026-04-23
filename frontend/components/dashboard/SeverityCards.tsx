"use client";

import { AlertCircle, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/incident";

interface SeverityCardsProps {
  counts: Record<Severity, number>;
  selected?: Severity;
  onSelect: (severity?: Severity) => void;
}

const toneMap: Record<Severity, string> = {
  Critical: "border-rose-500/40 bg-rose-500/5",
  High: "border-amber-500/40 bg-amber-500/5",
  Medium: "border-yellow-500/40 bg-yellow-500/5",
  Low: "border-cyan-500/40 bg-cyan-500/5"
};

const iconMap = {
  Critical: ShieldAlert,
  High: AlertTriangle,
  Medium: AlertCircle,
  Low: ShieldCheck
} as const;

export function SeverityCards({ counts, selected, onSelect }: SeverityCardsProps) {
  const severities: Severity[] = ["Critical", "High", "Medium", "Low"];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {severities.map((severity) => {
        const Icon = iconMap[severity];
        const isActive = selected === severity;
        return (
          <button key={severity} onClick={() => onSelect(isActive ? undefined : severity)} className="text-left">
            <Card className={cn("transition-colors hover:border-primary/60", toneMap[severity], isActive && "ring-2 ring-primary/40") }>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{severity}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{counts[severity]}</div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
