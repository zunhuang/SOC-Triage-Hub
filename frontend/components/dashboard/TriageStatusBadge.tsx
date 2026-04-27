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
  "For Triage": "border-[#E6E6E6] bg-[#F5F6F4] text-[#555555]",
  "Triage In Progress": "border-[#E8A317] bg-[#E8A317]/10 text-[#B07D12]",
  "Triage Complete": "border-[#86BC25] bg-[#86BC25] text-white",
  "Triage Failed": "border-[#DA291C] bg-[#DA291C] text-white",
  "Remediation Pending": "border-[#00A3E0] bg-[#00A3E0]/10 text-[#007AA8]",
  Resolved: "border-[#046A38] bg-[#046A38] text-white",
  Closed: "border-[#282728] bg-[#282728] text-white"
};

export function TriageStatusBadge({ status }: { status: string }) {
  const normalized = canonicalizeTriageStatus(status);
  return (
    <Badge variant={variantByStatus[normalized]} className={classByStatus[normalized]}>
      {normalized}
    </Badge>
  );
}
