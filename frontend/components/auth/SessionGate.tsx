"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export function SessionGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isPublicRoute = pathname === "/login";

  useEffect(() => {
    if (!isLoading && !isPublicRoute && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
    }
  }, [isLoading, isPublicRoute, user, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    );
  }

  return <>{children}</>;
}
