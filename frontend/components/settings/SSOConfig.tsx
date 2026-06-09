"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient, { ApiError } from "@/lib/api-client";
import { useAppSettings } from "@/hooks/use-settings";

export function SSOConfig() {
  const { data, mutate } = useAppSettings();
  const [status, setStatus] = useState<string>("");
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const currentEnabled = enabledOverride !== null ? enabledOverride : (data?.azure?.enabled ?? false);

  function buildPayload() {
    if (!data || !formRef.current) return null;
    const formData = new FormData(formRef.current);
    const clientSecret = String(formData.get("clientSecret") ?? "").trim();

    return {
      ...data,
      azure: {
        ...data.azure,
        enabled: currentEnabled,
        tenantId: String(formData.get("tenantId") ?? "").trim(),
        clientId: String(formData.get("clientId") ?? "").trim(),
        clientSecret: clientSecret || data.azure?.clientSecret || "",
      },
    };
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const payload = buildPayload();
    if (!payload) return;
    try {
      await apiClient.put("/api/settings", payload);
      await mutate();
      setStatus("SSO settings saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(`Failed to save: ${error.message}`);
        return;
      }
      setStatus("Failed to save SSO settings.");
    }
  }

  if (!data) return null;

  const azure = data.azure ?? { clientId: "", clientSecret: "", tenantId: "", enabled: false };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Microsoft Entra ID (Azure AD)</CardTitle>
        <CardDescription className="mt-1">
          Allow users to sign in with their Microsoft work account via OAuth 2.0. Users are automatically provisioned on first login with the &quot;analyst&quot; role; an admin can promote them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center gap-3">
            <input
              id="sso-enabled"
              type="checkbox"
              checked={currentEnabled}
              onChange={(e) => setEnabledOverride(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border accent-primary"
            />
            <Label htmlFor="sso-enabled" className="cursor-pointer">
              {currentEnabled ? "SSO enabled — users can sign in with Microsoft" : "SSO disabled"}
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="tenantId">Directory (Tenant) ID</Label>
              <Input
                id="tenantId"
                name="tenantId"
                defaultValue={azure.tenantId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!currentEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Azure Portal &rarr; App registrations &rarr; your app &rarr; Overview.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="clientId">Application (Client) ID</Label>
              <Input
                id="clientId"
                name="clientId"
                defaultValue={azure.clientId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!currentEnabled}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                name="clientSecret"
                type="password"
                defaultValue={azure.clientSecret}
                placeholder={azure.clientSecret ? "••••••••" : "Enter client secret value"}
                disabled={!currentEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Azure Portal &rarr; Certificates &amp; secrets &rarr; Client secrets.
              </p>
            </div>
          </div>

          {currentEnabled && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">App Registration — required settings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Redirect URI (Web):{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    http://localhost:8000/api/auth/azure/callback
                  </code>
                </li>
                <li>
                  API permissions:{" "}
                  <code className="rounded bg-muted px-1 py-0.5">openid profile email User.Read</code>
                </li>
              </ul>
            </div>
          )}

          <div>
            <Button type="submit">Save SSO Config</Button>
          </div>
        </form>
        {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
