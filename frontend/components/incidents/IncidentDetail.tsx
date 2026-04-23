"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Incident } from "@/types/incident";


const DESC_COLLAPSED_HEIGHT = 120;

function Row({ label, value, collapsible }: { label: string; value: unknown; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : String(value);

  const content = text || "-";
  const isLong = collapsible && text.length > 300;

  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">
        <div
          className={`font-medium break-all whitespace-pre-wrap ${isLong && !expanded ? "overflow-hidden" : ""}`}
          style={isLong && !expanded ? { maxHeight: DESC_COLLAPSED_HEIGHT, maskImage: "linear-gradient(black 60%, transparent)" } : undefined}
        >
          {content}
        </div>
        {isLong ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-primary hover:underline">
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function IncidentDetail({ incident }: { incident: Incident }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{incident.jiraKey} &mdash; {incident.summary}</span>
          <Badge variant="outline">{incident.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Row label="Summary" value={incident.summary} />
          <Row label="Description" value={incident.description} collapsible />
          <Row label="Priority" value={incident.priority} />
          <Row label="Status" value={incident.status} />
          <Row label="Project" value={`${incident.project} — ${incident.projectName}`} />
          <Row label="Assignee" value={incident.assignee} />
          <Row label="MXDR Module" value={incident.mxdrModule} />
          <Row label="Created At" value={format(new Date(incident.createdAt), "MMM d, yyyy HH:mm:ss")} />
          <Row label="Updated At" value={format(new Date(incident.updatedAt), "MMM d, yyyy HH:mm:ss")} />
        </div>

      </CardContent>
    </Card>
  );
}
