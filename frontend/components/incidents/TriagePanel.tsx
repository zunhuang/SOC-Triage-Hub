import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriageStatusBadge } from "@/components/dashboard/TriageStatusBadge";
import { canonicalizeTriageStatus } from "@/lib/triage-status";
import type { Incident } from "@/types/incident";

const CALLOUT_TOKENS = ["ASSUMPTION", "FLAG", "RISK", "RECOMMENDATION", "NOTE", "EVIDENCE", "FACT"];

const RISK_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /compliance|gdpr|pci|sox/i, label: "Compliance" },
  { pattern: /privileg|admin|elevated/i, label: "Privileged Access" },
  { pattern: /contractor|orphan|deprovision|offboarding/i, label: "Identity Lifecycle" },
  { pattern: /mfa|sso|saml|token|auth/i, label: "Authentication" },
  { pattern: /data|exfiltration|leak|breach/i, label: "Data Exposure" },
  { pattern: /workflow|integration|automation|silent failure/i, label: "Control Failure" }
];

function withCalloutLineBreaks(text: string): string {
  return CALLOUT_TOKENS.reduce(
    (acc, token) => acc.replace(new RegExp(`\\s+(${token}:)`, "gi"), "\n$1"),
    text
  );
}

function splitReadableLines(text: string): string[] {
  return withCalloutLineBreaks(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatUtcTimestamp(value?: string): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return `${format(parsed, "MMM d, yyyy HH:mm")} UTC`;
}

function confidenceBand(score: number): "High" | "Medium" | "Low" {
  if (score >= 80) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function confidenceTone(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

function extractRiskFlags(incident: Incident): string[] {
  const triage = incident.triageResults;
  if (!triage) {
    return [];
  }
  const source = [triage.summary, triage.rootCauseAnalysis, triage.impactAssessment].join(" ");
  const matches = new Set<string>();
  for (const { pattern, label } of RISK_KEYWORDS) {
    if (pattern.test(source)) {
      matches.add(label);
    }
  }
  return Array.from(matches);
}

function stripCalloutPrefix(line: string): string {
  return line.replace(/^([A-Za-z ]+:)\s*/g, "").trim();
}

function buildEvidenceSections(incident: Incident) {
  const triage = incident.triageResults;
  if (!triage) {
    return {
      facts: [] as string[],
      assumptions: [] as string[],
      risks: [] as string[],
      recommendations: [] as string[]
    };
  }

  const lines = splitReadableLines(
    [triage.summary, triage.rootCauseAnalysis, triage.impactAssessment]
      .filter(Boolean)
      .join("\n")
  );

  const sections = {
    facts: [] as string[],
    assumptions: [] as string[],
    risks: [] as string[],
    recommendations: [] as string[]
  };

  for (const line of lines) {
    if (/^(fact|evidence|observation):/i.test(line)) {
      sections.facts.push(stripCalloutPrefix(line));
      continue;
    }
    if (/^assumption:/i.test(line)) {
      sections.assumptions.push(stripCalloutPrefix(line));
      continue;
    }
    if (/^(risk|flag):/i.test(line)) {
      sections.risks.push(stripCalloutPrefix(line));
      continue;
    }
    if (/^(recommendation|next step|action):/i.test(line)) {
      sections.recommendations.push(stripCalloutPrefix(line));
      continue;
    }
  }

  return sections;
}

function EvidenceBlock({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <ul className="space-y-2 text-sm leading-6 text-foreground/90">
        {lines.map((line, idx) => (
          <li key={`${title}-${idx}-${line.slice(0, 24)}`}>- {line}</li>
        ))}
      </ul>
    </section>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-6 text-foreground/90">{value}</p>
    </div>
  );
}

export function TriagePanel({ incident }: { incident: Incident }) {
  const normalizedStatus = canonicalizeTriageStatus(incident.triageStatus);
  const triage = incident.triageResults;
  const risks = extractRiskFlags(incident);
  const sections = buildEvidenceSections(incident);
  const nextAction =
    incident.remediationSteps?.find((step) => step.status === "Pending" || step.status === "In Progress")?.action ||
    incident.remediationSteps?.[0]?.action ||
    "Review remediation plan and assign owner.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Triage Analysis</span>
          <TriageStatusBadge status={normalizedStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!triage && (
          <p className="text-sm text-muted-foreground">
            No triage output yet for this incident. Launch triage to generate analysis and remediation recommendations.
          </p>
        )}

        {triage ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{triage.iamCategory}</Badge>
              <Badge variant="secondary">{triage.iamSubCategory}</Badge>
              <Badge variant="outline">Agent {triage.triageAgent || "N/A"}</Badge>
              <Badge variant="outline">Completed {formatUtcTimestamp(triage.completedAt)}</Badge>
            </div>

            <section className="space-y-3 rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Confidence</p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{triage.confidenceScore}%</span>
                <span className="text-muted-foreground">{confidenceBand(triage.confidenceScore)} Confidence</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full ${confidenceTone(triage.confidenceScore)}`}
                  style={{ width: `${Math.max(0, Math.min(100, triage.confidenceScore))}%` }}
                />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Executive Summary</p>
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryField label="What Happened" value={triage.summary} />
                <SummaryField label="Likely Root Cause" value={triage.rootCauseAnalysis} />
                <SummaryField label="Business Impact" value={triage.impactAssessment} />
                <SummaryField label="Recommended Next Action" value={nextAction} />
              </div>
            </section>

            {risks.length > 0 ? (
              <section className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Risk Flags</p>
                <div className="flex flex-wrap gap-2">
                  {risks.map((risk) => (
                    <Badge key={risk} variant="destructive">
                      {risk}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Affected Systems</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {triage.affectedSystems.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No systems identified.</span>
                ) : (
                  triage.affectedSystems.map((system) => (
                    <Badge key={system} variant="outline">
                      {system}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <EvidenceBlock title="Facts Observed" lines={sections.facts} />
            <EvidenceBlock title="Assumptions" lines={sections.assumptions} />
            <EvidenceBlock title="Risk Notes" lines={sections.risks} />
            <EvidenceBlock title="Recommendations" lines={sections.recommendations} />

            <details className="rounded-lg border bg-muted/20 p-4">
              <summary className="cursor-pointer text-sm font-medium">Run Metadata</summary>
              <div className="mt-3 grid gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Agent:</span> {triage.triageAgent || "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Run ID:</span>{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{triage.kindoRunId || "-"}</code>
                </p>
                <p>
                  <span className="text-muted-foreground">Completed:</span> {formatUtcTimestamp(triage.completedAt)}
                </p>
              </div>
            </details>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
