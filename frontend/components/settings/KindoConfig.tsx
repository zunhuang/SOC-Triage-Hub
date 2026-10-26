"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { useAppSettings } from "@/hooks/use-settings";

function ModelSelect({
  id,
  label,
  help,
  value,
  models
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  models: string[];
}) {
  // Keep a saved value selectable even if the tenant's model list no longer includes it.
  const options = value && !models.includes(value) ? [value, ...models] : models;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={value}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Default</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

export function KindoConfig() {
  const { data, mutate } = useAppSettings();
  const { data: models } = useSWR<{ models: string[] }>("/api/kindo/models", (path: string) => apiClient.get(path), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [status, setStatus] = useState("");

  if (!data) return null;

  async function saveKindoConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const formData = new FormData(event.currentTarget);
    const apiKey = String(formData.get("kindoApiKey") ?? "").trim();

    const payload = {
      ...data,
      kindo: {
        tenantUrl: String(formData.get("kindoTenantUrl") ?? "").trim(),
        inferenceUrl: String(formData.get("kindoInferenceUrl") ?? "").trim(),
        apiKey: apiKey || data.kindo.apiKey,
        chatModel: String(formData.get("kindoChatModel") ?? "").trim(),
        runChatModel: String(formData.get("kindoRunChatModel") ?? "").trim(),
      },
    };

    await apiClient.put("/api/settings", payload);
    await mutate();
    setStatus("Kindo settings saved.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kindo Configuration</CardTitle>
        <CardDescription>
          Set your Kindo tenant endpoint and API key used for agent listing and triage runs.
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Fields marked with <span className="font-semibold">*</span> are required. Initial defaults are loaded from your backend <code>.env</code> file.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={saveKindoConfig} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="kindoTenantUrl">Kindo Tenant URL *</Label>
            <Input
              id="kindoTenantUrl"
              name="kindoTenantUrl"
              defaultValue={data.kindo.tenantUrl}
              placeholder="https://api.kindo.ai/v1"
              required
            />
            <p className="text-xs text-muted-foreground">
              Base Kindo Agent API URL for your tenant.
            </p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="kindoInferenceUrl">Kindo Inference URL *</Label>
            <Input
              id="kindoInferenceUrl"
              name="kindoInferenceUrl"
              defaultValue={data.kindo.inferenceUrl}
              placeholder="https://llm.kindo.ai/v1"
              required
            />
            <p className="text-xs text-muted-foreground">
              OpenAI-compatible inference endpoint used for direct model calls.
            </p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="kindoApiKey">Kindo API Key *</Label>
            <Input
              id="kindoApiKey"
              name="kindoApiKey"
              type="password"
              defaultValue={data.kindo.apiKey}
              placeholder="kindo-..."
              required
            />
            <p className="text-xs text-muted-foreground">
              API key sent via the <code>api-key</code> header when calling Kindo APIs.
            </p>
          </div>

          <ModelSelect
            id="kindoChatModel"
            label="CDA Chat model"
            help="Used by the floating CDA Chat (general assistant). Must be a Claude model."
            value={data.kindo.chatModel ?? ""}
            models={models?.models ?? []}
          />

          <ModelSelect
            id="kindoRunChatModel"
            label="Investigate Further model"
            help="Used when continuing a triage run on a record. Any model on your tenant."
            value={data.kindo.runChatModel ?? ""}
            models={models?.models ?? []}
          />

          <div className="md:col-span-2">
            <Button type="submit">Save Kindo Settings</Button>
          </div>
        </form>
        {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
