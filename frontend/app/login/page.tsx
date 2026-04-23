"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEMO_PASSWORD,
  DEMO_SESSION_KEY,
  DEMO_SESSION_VALUE,
  DEMO_USERNAME
} from "@/lib/demo-auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [username, setUsername] = useState(DEMO_USERNAME);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = localStorage.getItem(DEMO_SESSION_KEY);
    if (existing === DEMO_SESSION_VALUE) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      localStorage.setItem(DEMO_SESSION_KEY, DEMO_SESSION_VALUE);
      router.replace(nextPath);
      return;
    }

    setError("Invalid credentials. Use the demo values shown below.");
  }

  return (
    <div className="mx-auto mt-16 max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <p className="text-sm text-muted-foreground">Use demo credentials to access Detect and Respond.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-sm">
              Username
              <div className="relative mt-1">
                <UserRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" />
              </div>
            </label>
            <label className="block text-sm">
              Password
              <div className="relative mt-1">
                <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
              </div>
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Demo Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Username:</span> {DEMO_USERNAME}</p>
          <p><span className="font-medium">Password:</span> {DEMO_PASSWORD}</p>
        </CardContent>
      </Card>
    </div>
  );
}
