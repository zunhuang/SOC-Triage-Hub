"use client";

import { useState } from "react";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { deriveDetectionSource } from "@/lib/detection-source";
import type { Incident } from "@/types/incident";

const DESC_COLLAPSED_HEIGHT = 120;

const priorityPillStyle: Record<string, string> = {
  Highest: "border border-[rgba(218,41,28,0.2)] bg-[#FDEEEC] text-[#8B0F08]",
  High: "border border-[rgba(218,41,28,0.2)] bg-[#FDEEEC] text-[#8B0F08]",
  Medium: "border border-[rgba(217,119,6,0.2)] bg-[#FEF4E6] text-[#8B5400]",
  Low: "border border-[rgba(134,188,37,0.25)] bg-[#F1F8E5] text-[#5A8217]",
  Lowest: "border border-[rgba(0,163,224,0.25)] bg-[#E5F6FC] text-[#005587]",
};

const priorityDotColor: Record<string, string> = {
  Highest: "#DA291C",
  High: "#DA291C",
  Medium: "#D97706",
  Low: "#86BC25",
  Lowest: "#00A3E0",
};

function MetadataRow({
  label,
  children,
  collapsible,
  text,
}: {
  label: string;
  children?: React.ReactNode;
  collapsible?: boolean;
  text?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = collapsible && (text?.length ?? 0) > 300;

  return (
    <div className="grid grid-cols-[130px_1fr] gap-4 border-b border-[#F2F2F2] px-[22px] py-3 transition-colors last:border-b-0 hover:bg-[#FAFBF8]">
      <span className="pt-px text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dl-text-secondary)]">
        {label}
      </span>
      <div className="min-w-0 text-[13px] text-[var(--foreground)]">
        {collapsible && text ? (
          <>
            <div
              className={`break-all whitespace-pre-wrap ${isLong && !expanded ? "overflow-hidden" : ""}`}
              style={
                isLong && !expanded
                  ? { maxHeight: DESC_COLLAPSED_HEIGHT, maskImage: "linear-gradient(black 60%, transparent)" }
                  : undefined
              }
            >
              {text}
            </div>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-1.5 text-xs font-semibold text-[var(--dl-green-dark)] hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function IncidentDetail({ incident }: { incident: Incident }) {
  const detectionSource = deriveDetectionSource(incident.summary);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--dl-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-[var(--dl-border)] px-[22px] py-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] place-items-center rounded-[6px] bg-[rgba(134,188,37,0.12)] text-[var(--dl-green-dark)]">
            <FileText className="size-3.5" />
          </div>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.10em] text-[var(--foreground)]">
            Incident Detail
          </h3>
        </div>
        <TriageStatusBadge status={incident.status} />
      </div>

      <div className="py-1">
        <MetadataRow label="Summary">
          <span>{incident.summary}</span>
        </MetadataRow>

        <MetadataRow label="Description" collapsible text={incident.description || ""} />

        <MetadataRow label="Priority">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityPillStyle[incident.priority] ?? "bg-[#F0F0F0] text-[#6B6B6B]"}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: priorityDotColor[incident.priority] ?? "#999" }}
            />
            {incident.priority}
          </span>
        </MetadataRow>

        <MetadataRow label="Triage Status">
          <TriageStatusBadge status={incident.triageStatus} />
        </MetadataRow>

        <MetadataRow label="Project">
          <span>
            <strong className="font-semibold">{incident.project}</strong>
            {" — "}
            {incident.projectName}
          </span>
        </MetadataRow>

        <MetadataRow label="Assignee">
          {incident.assignee ? (
            <span>{incident.assignee}</span>
          ) : (
            <span className="italic text-[#B0B0B0]">Unassigned</span>
          )}
        </MetadataRow>

        <MetadataRow label="MXDR Module">
          {incident.mxdrModule ? (
            <span>{incident.mxdrModule}</span>
          ) : (
            <span className="italic text-[#B0B0B0]">Not set</span>
          )}
        </MetadataRow>

        {detectionSource && (
          <MetadataRow label="Detection Source">
            <span>
              {detectionSource.label}
              <span className="ml-2 font-mono text-[11px] text-[var(--dl-text-secondary)]">
                &middot; {detectionSource.tag}
              </span>
            </span>
          </MetadataRow>
        )}

        <MetadataRow label="Created At">
          <span className="font-mono text-[12px] tabular-nums">
            {format(new Date(incident.createdAt), "MMM d, yyyy HH:mm:ss")}
          </span>
        </MetadataRow>

        <MetadataRow label="Updated At">
          <span className="font-mono text-[12px] tabular-nums">
            {format(new Date(incident.updatedAt), "MMM d, yyyy HH:mm:ss")}
          </span>
        </MetadataRow>
      </div>
    </div>
  );
}
