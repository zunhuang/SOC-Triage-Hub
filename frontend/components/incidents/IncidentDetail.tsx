import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Incident } from "@/types/incident";

function Row({ label, value }: { label: string; value: unknown }) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : String(value);
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
          <span>{incident.jiraKey} &mdash; {incident.summary}</span>
          <Badge variant="outline">{incident.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Row label="Summary" value={incident.summary} />
          <Row label="Description" value={incident.description} />
          <Row label="Priority" value={incident.priority} />
          <Row label="Status" value={incident.status} />
          <Row label="Project" value={`${incident.project} — ${incident.projectName}`} />
          <Row label="Assignee" value={incident.assignee} />
          <Row label="MXDR Module" value={incident.mxdrModule} />
          <Row label="Created At" value={format(new Date(incident.createdAt), "MMM d, yyyy HH:mm:ss")} />
          <Row label="Updated At" value={format(new Date(incident.updatedAt), "MMM d, yyyy HH:mm:ss")} />
        </div>

        {triage ? (
          <section className="space-y-3 rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Incident vs AI Correlation</p>
            <div className="grid gap-3 md:grid-cols-2">
              <SnapshotField label="Jira Status" value={incident.status} />
              <SnapshotField label="AI Category" value={triage.iamCategory} />
              <SnapshotField label="Jira Priority" value={incident.priority} />
              <SnapshotField label="AI Subcategory" value={triage.iamSubCategory} />
              <SnapshotField label="MXDR Module" value={incident.mxdrModule ?? "-"} />
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
