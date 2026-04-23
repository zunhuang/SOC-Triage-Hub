import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Incident } from "@/types/incident";

function normalizeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const ref = value as { display_value?: unknown; value?: unknown; link?: unknown };
    if (typeof ref.display_value === "string" && ref.display_value.trim()) return ref.display_value;
    if (typeof ref.value === "string" && ref.value.trim()) return ref.value;
    if (typeof ref.link === "string" && ref.link.trim()) return ref.link;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function Row({ label, value }: { label: string; value: unknown }) {
  const text = normalizeDisplayValue(value);
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{text || "-"}</span>
    </div>
  );
}

function SnapshotField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground/90">{value || "-"}</p>
    </div>
  );
}

export function IncidentDetail({ incident }: { incident: Incident }) {
  const triage = incident.triageResults;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{incident.number}</span>
          <Badge variant="outline">{incident.state}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Row label="Short Description" value={incident.shortDescription} />
          <Row label="Description" value={incident.description} />
          <Row label="Severity" value={incident.severity} />
          <Row label="Priority" value={incident.priority} />
          <Row label="Assignment Group" value={incident.assignmentGroup} />
          <Row label="Assigned To" value={incident.assignedTo} />
          <Row label="Caller" value={incident.caller} />
          <Row label="Category" value={incident.category} />
          <Row label="Subcategory" value={incident.subcategory} />
          <Row label="Configuration Item" value={incident.configurationItem} />
          <Row label="Opened At" value={format(new Date(incident.openedAt), "MMM d, yyyy HH:mm:ss")} />
          <Row label="Updated At" value={format(new Date(incident.updatedAt), "MMM d, yyyy HH:mm:ss")} />
        </div>

        {triage ? (
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Incident vs AI Correlation</p>
            <div className="grid gap-3 md:grid-cols-2">
              <SnapshotField label="ServiceNow State" value={incident.state} />
              <SnapshotField label="AI Category" value={triage.iamCategory} />
              <SnapshotField label="ServiceNow Priority" value={incident.priority} />
              <SnapshotField label="AI Subcategory" value={triage.iamSubCategory} />
              <SnapshotField label="ServiceNow Severity" value={incident.severity} />
              <SnapshotField label="AI Confidence" value={`${triage.confidenceScore}%`} />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Impact Narrative</p>
              <p className="mt-1 text-sm leading-6 text-foreground/90">{triage.impactAssessment}</p>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
