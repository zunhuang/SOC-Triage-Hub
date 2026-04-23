import { Badge } from "@/components/ui/badge";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { IncidentStatus } from "@/types/incident";

const variantByStatus: Record<IncidentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  "For Triage": "outline",
  "Triage In Progress": "secondary",
  "Triage Complete": "default",
  "Triage Failed": "destructive",
  "Remediation Pending": "secondary",
  Resolved: "default",
  Closed: "default"
};

const classByStatus: Partial<Record<IncidentStatus, string>> = {
  "For Triage": "border-slate-300 bg-slate-100 text-slate-900",
  "Triage In Progress": "border-amber-300 bg-amber-100 text-amber-900",
  "Triage Complete": "border-emerald-600 bg-emerald-600 text-white",
  "Triage Failed": "border-red-600 bg-red-600 text-white",
  "Remediation Pending": "border-sky-500 bg-sky-100 text-sky-900",
  Resolved: "border-emerald-700 bg-emerald-700 text-white",
  Closed: "border-zinc-700 bg-zinc-700 text-white"
};

export function TriageStatusBadge({ status }: { status: string }) {
  const normalized = canonicalizeTriageStatus(status);
  return (
    <Badge variant={variantByStatus[normalized]} className={classByStatus[normalized]}>
      {normalized}
    </Badge>
  );
}
