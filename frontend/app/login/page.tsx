"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const { user, isLoading, refetch } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [azureEnabled, setAzureEnabled] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(nextPath);
    }
  }, [isLoading, user, nextPath, router]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    fetch(`${base}/api/auth/providers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setAzureEnabled(data?.azure === true))
      .catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiClient.post("/api/auth/login", { email, password });
      await refetch();
      router.replace(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleAzureLogin() {
    const next = encodeURIComponent(nextPath);
    window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/auth/azure/login?next=${next}`;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Image
            src="/deloitte-logo-white.svg"
            alt="Deloitte"
            width={120}
            height={28}
            priority
            className="mx-auto mb-2 h-7 w-auto brightness-0"
          />
          <p className="text-sm font-medium tracking-[0.1em] text-muted-foreground">DETECT AND RESPOND</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <h2 className="text-xl font-semibold">Sign In</h2>
            <p className="text-sm text-muted-foreground">Enter your credentials to access the platform.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {azureEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleAzureLogin}
                >
                  <MicrosoftIcon />
                  Sign in with Microsoft
                </Button>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                Email
                <div className="relative mt-1.5">
                  <UserRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="you@deloitte.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="block text-sm font-medium">
                Password
                <div className="relative mt-1.5">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
