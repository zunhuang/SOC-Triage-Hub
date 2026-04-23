"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Copy, Cpu, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RemediationStep } from "@/types/incident";

type Phase = "Immediate" | "Short-Term" | "Long-Term" | "Validation" | "General";

const PHASE_ORDER: Phase[] = ["Immediate", "Short-Term", "Long-Term", "Validation", "General"];

function detectPhase(step: RemediationStep): Phase {
  const text = step.action.toLowerCase();
  if (text.startsWith("immediate action:")) return "Immediate";
  if (text.startsWith("short-term fix:")) return "Short-Term";
  if (text.startsWith("long-term fix:")) return "Long-Term";
  if (text.startsWith("verification:")) return "Validation";
  return "General";
}

function stripPhasePrefix(action: string): string {
  return action
    .replace(/^Immediate Action:\s*/i, "")
    .replace(/^Short-Term Fix:\s*/i, "")
    .replace(/^Long-Term Fix:\s*/i, "")
    .replace(/^Verification:\s*/i, "")
    .trim();
}

function ownerForStep(step: RemediationStep): string {
  return step.automatable ? "Automation Bot" : "Detect and Respond";
}

function priorityForStep(step: RemediationStep, nextStepNumber: number | null): "Now" | "High" | "Medium" | "Low" {
  if (nextStepNumber !== null && step.stepNumber === nextStepNumber) return "Now";
  if (step.stepNumber <= 2) return "High";
  if (step.stepNumber <= 4) return "Medium";
  return "Low";
}

export function RemediationSteps({ steps }: { steps: RemediationStep[] }) {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const nextStepNumber = useMemo(() => {
    const candidate = steps
      .filter((step) => step.status === "Pending" || step.status === "In Progress")
      .sort((a, b) => a.stepNumber - b.stepNumber)[0];
    return candidate ? candidate.stepNumber : null;
  }, [steps]);

  const grouped = useMemo(() => {
    const buckets: Record<Phase, RemediationStep[]> = {
      Immediate: [],
      "Short-Term": [],
      "Long-Term": [],
      Validation: [],
      General: []
    };

    for (const step of steps) {
      buckets[detectPhase(step)].push(step);
    }

    return buckets;
  }, [steps]);

  async function copyCommands(stepNumber: number, commands: string) {
    try {
      await navigator.clipboard.writeText(commands);
      setCopiedStep(stepNumber);
      window.setTimeout(() => setCopiedStep((current) => (current === stepNumber ? null : current)), 1500);
    } catch {
      setCopiedStep(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remediation Action Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {steps.length === 0 && <p className="text-sm text-muted-foreground">No remediation steps available.</p>}

        {PHASE_ORDER.map((phase) => {
          const phaseSteps = grouped[phase];
          if (phaseSteps.length === 0) {
            return null;
          }

          return (
            <section key={phase} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{phase} Phase</p>
                <Badge variant="outline">{phaseSteps.length} step(s)</Badge>
              </div>

              {phaseSteps
                .slice()
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step) => {
                  const priority = priorityForStep(step, nextStepNumber);
                  const isNext = nextStepNumber !== null && step.stepNumber === nextStepNumber;
                  return (
                    <div key={`${phase}-${step.stepNumber}`} className={`rounded-lg border p-4 ${isNext ? "border-primary/60 bg-primary/5" : ""}`}>
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">
                          {step.stepNumber}. {stripPhasePrefix(step.action)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={priority === "Now" ? "default" : "outline"}>{priority}</Badge>
                          <Badge variant={step.automatable ? "default" : "outline"}>{step.automatable ? "Automatable" : "Manual"}</Badge>
                          <Badge variant="secondary">{step.status}</Badge>
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3" /> {step.estimatedMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Cpu className="size-3" /> {step.system}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" /> {ownerForStep(step)}
                        </span>
                      </div>

                      {step.commands ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Commands</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => copyCommands(step.stepNumber, step.commands as string)}
                            >
                              {copiedStep === step.stepNumber ? <Check className="mr-1 size-3" /> : <Copy className="mr-1 size-3" />}
                              {copiedStep === step.stepNumber ? "Copied" : "Copy"}
                            </Button>
                          </div>
                          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{step.commands}</pre>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
