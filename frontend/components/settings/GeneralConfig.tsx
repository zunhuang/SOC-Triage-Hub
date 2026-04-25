"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { useAppSettings, useSchedulerStatus } from "@/hooks/use-settings";

function SchedulerIndicator() {
  const { data } = useSchedulerStatus();
  if (!data) return null;

  const nextRun = data.nextRunAt ? new Date(data.nextRunAt) : null;
  const now = new Date();
  const secsUntil = nextRun ? Math.max(0, Math.round((nextRun.getTime() - now.getTime()) / 1000)) : null;

  let countdown = "";
  if (secsUntil !== null) {
    const mins = Math.floor(secsUntil / 60);
    const secs = secsUntil % 60;
    countdown = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <span className={`inline-block h-2 w-2 rounded-full ${data.running && data.jobScheduled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
      {data.running && data.jobScheduled ? (
        <span>
          Scheduler active — every {data.intervalMinutes} min
          {countdown && <span className="text-muted-foreground"> — next run in {countdown}</span>}
        </span>
      ) : (
        <span className="text-muted-foreground">Scheduler inactive</span>
      )}
    </div>
  );
}

export function GeneralConfig() {
  const { data, mutate } = useAppSettings();
  const { mutate: refreshScheduler } = useSchedulerStatus();
  const [status, setStatus] = useState("");

  if (!data) return null;

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...data,
      llmProvider: String(formData.get("llmProvider")) as "openai" | "anthropic" | "gemini",
      enableScheduler: formData.get("enableScheduler") === "on",
      autoTriageEnabled: formData.get("autoTriageEnabled") === "on",
      autoPostToJira: formData.get("autoPostToJira") === "on",
      logLevel: String(formData.get("logLevel")) as "debug" | "info" | "warning" | "error"
    };

    await apiClient.put("/api/settings", payload);
    await mutate();
    await refreshScheduler();
    setStatus("General settings saved.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          Control global runtime behavior for triage, logging, and model selection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Fields marked with <span className="font-semibold">*</span> are required.</p>
        <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="llmProvider">LLM Provider *</Label>
            <select
              id="llmProvider"
              name="llmProvider"
              defaultValue={data.llmProvider}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3"
              required
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Provider used for direct LLM tasks and fallback analysis flows.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="logLevel">Log Level *</Label>
            <select
              id="logLevel"
              name="logLevel"
              defaultValue={data.logLevel}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3"
              required
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Set API logging verbosity. Use <code>info</code> for normal operations.
            </p>
          </div>

          <div className="space-y-3 md:col-span-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Automation Pipeline</p>
              <SchedulerIndicator />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Label htmlFor="enableScheduler" className="inline-flex items-center gap-2 font-normal">
                <input id="enableScheduler" name="enableScheduler" type="checkbox" defaultChecked={data.enableScheduler} />
                Enable scheduler
              </Label>
              <Label htmlFor="autoTriageEnabled" className="inline-flex items-center gap-2 font-normal">
                <input id="autoTriageEnabled" name="autoTriageEnabled" type="checkbox" defaultChecked={data.autoTriageEnabled} />
                Auto-triage new incidents
              </Label>
              <Label htmlFor="autoPostToJira" className="inline-flex items-center gap-2 font-normal">
                <input id="autoPostToJira" name="autoPostToJira" type="checkbox" defaultChecked={data.autoPostToJira} />
                Auto-post results to Jira
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, the scheduler syncs Jira using the poll interval configured in Jira Settings. Auto-triage sends new incidents to the Kindo agent. Auto-post writes triage results back as Jira comments.
            </p>
          </div>

          <div className="md:col-span-2">
            <Button type="submit">Save General Settings</Button>
          </div>
        </form>
        {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
