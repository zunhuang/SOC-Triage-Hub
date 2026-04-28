import { Check } from "lucide-react";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { IncidentStatus } from "@/types/incident";

const pillStyle: Record<IncidentStatus, string> = {
  "For Triage": "border border-[#E6E6E6] bg-[#F5F6F4] text-[#6B6B6B]",
  "Triage In Progress": "border border-[rgba(0,163,224,0.25)] bg-[#E5F6FC] text-[#005587]",
  "Triage Complete": "bg-[#86BC25] text-white",
  "Triage Failed": "bg-[#DA291C] text-white",
  "Remediation Pending": "border border-[rgba(0,163,224,0.25)] bg-[#E5F6FC] text-[#005587]",
  Resolved: "bg-[#5A8217] text-white",
  Closed: "bg-[#282728] text-white",
};

const showCheckIcon: Partial<Record<IncidentStatus, boolean>> = {
  Resolved: true,
  Closed: true,
};

export function TriageStatusBadge({ status }: { status: string }) {
  const normalized = canonicalizeTriageStatus(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pillStyle[normalized] ?? "bg-[#F0F0F0] text-[#6B6B6B]"}`}
    >
      {showCheckIcon[normalized] && <Check className="size-[11px]" />}
      {normalized}
    </span>
  );
}
