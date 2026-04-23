"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { useAppSettings } from "@/hooks/use-settings";

export function GeneralConfig() {
  const { data, mutate } = useAppSettings();
  const [status, setStatus] = useState("");

  if (!data) return null;

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      ...data,
      llmProvider: String(formData.get("llmProvider")) as "openai" | "anthropic" | "gemini",
      autoTriageEnabled: formData.get("autoTriageEnabled") === "on",
      logLevel: String(formData.get("logLevel")) as "debug" | "info" | "warning" | "error",
      pollIntervalMinutes: Number(formData.get("pollIntervalMinutes") ?? data.pollIntervalMinutes)
    };

    await apiClient.put("/api/settings", payload);
    await mutate();
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

          <div className="space-y-1">
            <Label htmlFor="pollIntervalMinutes">Default Poll Interval (Minutes) *</Label>
            <Input
              id="pollIntervalMinutes"
              name="pollIntervalMinutes"
              type="number"
              min={1}
              max={60}
              defaultValue={data.pollIntervalMinutes}
            />
            <p className="text-xs text-muted-foreground">
              Base scheduler interval used unless Jira-specific value overrides it.
            </p>
          </div>

          <div className="space-y-1 self-end">
            <Label htmlFor="autoTriageEnabled" className="inline-flex items-center gap-2">
              <input id="autoTriageEnabled" name="autoTriageEnabled" type="checkbox" defaultChecked={data.autoTriageEnabled} />
              Enable auto-triage (optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically trigger Kindo triage for newly synced incidents.
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
