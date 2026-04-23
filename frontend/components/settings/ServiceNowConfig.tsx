"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient, { ApiError } from "@/lib/api-client";
import { useAppSettings } from "@/hooks/use-settings";

export function ServiceNowConfig() {
  const { data, mutate } = useAppSettings();
  const [status, setStatus] = useState<string>("");
  const formRef = useRef<HTMLFormElement | null>(null);

  function normalizeServiceNowUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return value;

    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(withScheme);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return value;
    }
  }

  function buildPayload() {
    if (!data || !formRef.current) return null;
    const formData = new FormData(formRef.current);
    const passwordInput = String(formData.get("password") ?? "").trim();

    return {
      ...data,
      serviceNow: {
        instanceUrl: normalizeServiceNowUrl(String(formData.get("instanceUrl") ?? "")),
        username: String(formData.get("username") ?? "").trim(),
        password: passwordInput || data.serviceNow.password,
        assignmentGroup: String(formData.get("assignmentGroup") ?? "").trim(),
        pollIntervalMinutes: Number(formData.get("pollIntervalMinutes") ?? 5)
      }
    };
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    try {
      const payload = buildPayload();
      if (!payload) return;

      await apiClient.put("/api/settings", payload);
      await mutate();
      setStatus("ServiceNow settings saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(`Failed to save ServiceNow settings: ${error.message}`);
        return;
      }
      setStatus("Failed to save ServiceNow settings.");
    }
  }

  async function testConnection() {
    try {
      const payload = buildPayload();
      if (!payload) return;

      // Always persist current form values before testing so Test uses what user just typed.
      await apiClient.put("/api/settings", payload);
      await mutate();

      const result = await apiClient.post<{ success: boolean; message: string }>("/api/servicenow/test");
      setStatus(result.message);
    } catch (error) {
      if (error instanceof ApiError) {
        const reason =
          typeof error.details === "object" &&
          error.details !== null &&
          "reason" in error.details &&
          typeof (error.details as { reason?: unknown }).reason === "string"
            ? (error.details as { reason: string }).reason
            : undefined;

        setStatus(`ServiceNow test failed: ${error.message}${reason ? ` (${reason})` : ""}`);
        return;
      }
      setStatus("ServiceNow test failed.");
    }
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>ServiceNow</CardTitle>
          <CardDescription className="mt-1">
            Configure how incidents are pulled from your ServiceNow queue.
          </CardDescription>
          <p className="mt-1 text-xs text-muted-foreground">
            Auth mode used by this integration: <strong>Basic Auth (username + password/token)</strong>.
            API keys and OAuth client credentials are not yet implemented in this UI.
          </p>
        </div>
        <Button variant="outline" onClick={testConnection}>Test Connection</Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Fields marked with <span className="font-semibold">*</span> are required.</p>
        <form ref={formRef} onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="instanceUrl">ServiceNow Instance URL *</Label>
            <Input
              id="instanceUrl"
              name="instanceUrl"
              defaultValue={data.serviceNow.instanceUrl}
              placeholder="https://instance.service-now.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Base URL for your ServiceNow tenant. Example: <code>https://company.service-now.com</code>.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="username">API Username *</Label>
            <Input
              id="username"
              name="username"
              defaultValue={data.serviceNow.username}
              placeholder="api_user"
              required
            />
            <p className="text-xs text-muted-foreground">
              Service account username used for Table API authentication.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">API Password / Token *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              defaultValue={data.serviceNow.password}
              placeholder="Enter ServiceNow API password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Password (or token, if your instance maps one) for the API username above.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="assignmentGroup">Assignment Group *</Label>
            <Input
              id="assignmentGroup"
              name="assignmentGroup"
              defaultValue={data.serviceNow.assignmentGroup}
              placeholder="IAM Operations"
              required
            />
            <p className="text-xs text-muted-foreground">
              Queue/group to sync incidents from. Use display name or group <code>sys_id</code>.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pollIntervalMinutes">Polling Interval (Minutes) *</Label>
            <Input
              id="pollIntervalMinutes"
              name="pollIntervalMinutes"
              type="number"
              defaultValue={data.serviceNow.pollIntervalMinutes}
              min={1}
              max={60}
              required
            />
            <p className="text-xs text-muted-foreground">
              Frequency for scheduled sync checks. Allowed range: 1 to 60 minutes.
            </p>
          </div>

          <div className="md:col-span-2">
            <Button type="submit">Save ServiceNow Config</Button>
          </div>
        </form>
        {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
