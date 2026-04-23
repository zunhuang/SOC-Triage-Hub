"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEMO_SESSION_KEY, DEMO_SESSION_VALUE } from "@/lib/demo-auth";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getClientSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(DEMO_SESSION_KEY);
}

function getServerSnapshot() {
  return null;
}

export function SessionGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/login";
  const sessionValue = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const isAuthenticated = sessionValue === DEMO_SESSION_VALUE;

  useEffect(() => {
    if (!isPublicRoute && !isAuthenticated) {
      const target = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(target)}`);
    }
  }, [isAuthenticated, isPublicRoute, pathname, router]);

  if (!isPublicRoute && !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
