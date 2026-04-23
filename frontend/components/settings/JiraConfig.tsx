"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient, { ApiError } from "@/lib/api-client";
import { useAppSettings } from "@/hooks/use-settings";

export function JiraConfig() {
  const { data, mutate } = useAppSettings();
  const [status, setStatus] = useState<string>("");
  const formRef = useRef<HTMLFormElement | null>(null);

  function buildPayload() {
    if (!data || !formRef.current) return null;
    const formData = new FormData(formRef.current);
    const passwordInput = String(formData.get("password") ?? "").trim();

    return {
      ...data,
      jira: {
        baseUrl: String(formData.get("baseUrl") ?? "").trim().replace(/\/+$/, ""),
        username: String(formData.get("username") ?? "").trim(),
        password: passwordInput || data.jira.password,
        jql: String(formData.get("jql") ?? "").trim(),
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
      setStatus("Jira settings saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(`Failed to save Jira settings: ${error.message}`);
        return;
      }
      setStatus("Failed to save Jira settings.");
    }
  }

  async function testConnection() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const baseUrl = String(formData.get("baseUrl") ?? "").trim().replace(/\/+$/, "");
    const username = String(formData.get("username") ?? "").trim();
    const passwordInput = String(formData.get("password") ?? "").trim();
    const password = passwordInput || data?.jira.password || "";

    try {
      const result = await apiClient.post<{ success: boolean; message: string }>("/api/jira/test", {
        baseUrl,
        username,
        password
      });
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

        setStatus(`Jira test failed: ${error.message}${reason ? ` (${reason})` : ""}`);
        return;
      }
      setStatus("Jira test failed.");
    }
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Jira Data Center</CardTitle>
          <CardDescription className="mt-1">
            Configure how issues are pulled from your Jira instance.
          </CardDescription>
          <p className="mt-1 text-xs text-muted-foreground">
            Auth mode: <strong>Basic Auth (username + password/token)</strong>.
          </p>
        </div>
        <Button variant="outline" onClick={testConnection}>Test Connection</Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Fields marked with <span className="font-semibold">*</span> are required.</p>
        <form ref={formRef} onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="baseUrl">Jira Base URL *</Label>
            <Input
              id="baseUrl"
              name="baseUrl"
              defaultValue={data.jira.baseUrl}
              placeholder="https://jira.company.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Base URL for your Jira Data Center instance. Example: <code>https://jira.company.com</code>.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              name="username"
              defaultValue={data.jira.username}
              placeholder="api_user"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password / Token *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              defaultValue={data.jira.password}
              placeholder="Enter Jira password or API token"
              required
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="jql">JQL Filter *</Label>
            <Input
              id="jql"
              name="jql"
              defaultValue={data.jira.jql}
              placeholder='project = "SOC" AND statusCategory != Done'
              required
            />
            <p className="text-xs text-muted-foreground">
              JQL query to select which issues are synced. Only issues matching this query will be imported.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pollIntervalMinutes">Poll Interval (Minutes) *</Label>
            <Input
              id="pollIntervalMinutes"
              name="pollIntervalMinutes"
              type="number"
              defaultValue={data.jira.pollIntervalMinutes}
              min={1}
              max={60}
              required
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit">Save Jira Config</Button>
          </div>
        </form>
        {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
