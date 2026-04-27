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
  "For Triage": "border-gray-300 bg-gray-100 text-gray-700",
  "Triage In Progress": "border-amber-400 bg-amber-50 text-amber-800",
  "Triage Complete": "border-[#86BC25] bg-[#86BC25] text-white",
  "Triage Failed": "border-red-600 bg-red-600 text-white",
  "Remediation Pending": "border-[#0097A9] bg-[#E6F7F9] text-[#007585]",
  Resolved: "border-[#046A38] bg-[#046A38] text-white",
  Closed: "border-[#1A1A1A] bg-[#1A1A1A] text-white"
};

export function TriageStatusBadge({ status }: { status: string }) {
  const normalized = canonicalizeTriageStatus(status);
  return (
    <Badge variant={variantByStatus[normalized]} className={classByStatus[normalized]}>
      {normalized}
    </Badge>
  );
}
