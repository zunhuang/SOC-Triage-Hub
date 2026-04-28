"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEMO_PASSWORD,
  DEMO_SESSION_KEY,
  DEMO_SESSION_VALUE,
  DEMO_USERNAME
} from "@/lib/demo-auth";

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
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                Username
                <div className="relative mt-1.5">
                  <UserRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" />
                </div>
              </label>
              <label className="block text-sm font-medium">
                Password
                <div className="relative mt-1.5">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
                </div>
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-[#F1F6E4]/50">
          <CardContent className="py-3 text-center text-sm">
            <span className="text-muted-foreground">Demo: </span>
            <span className="font-medium">{DEMO_USERNAME}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="font-medium">{DEMO_PASSWORD}</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
