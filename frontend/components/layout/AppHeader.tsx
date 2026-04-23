"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEMO_SESSION_KEY } from "@/lib/demo-auth";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem(DEMO_SESSION_KEY);
    router.push("/login");
  }

  return (
    <header className="border-b border-white/10 bg-black text-white">
      <div className="flex w-full items-center justify-start gap-4 px-4 py-2 md:px-6">
        <div className="inline-flex items-center gap-3">
          <Image
            src="/deloitte-logo-white.svg"
            alt="Deloitte"
            width={90}
            height={20}
            priority
            className="h-5 w-auto"
          />
          <span className="text-sm font-medium tracking-[0.08em] text-white/90">
            IAM Operations Dashboard
          </span>
        </div>
        {pathname !== "/login" ? (
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="border-white/40 bg-transparent text-white hover:bg-white/10" onClick={logout}>
              Logout
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
