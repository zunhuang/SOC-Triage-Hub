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
    <header>
      <div className="bg-black text-white">
        <div className="flex w-full items-center justify-start gap-4 px-4 py-2.5 md:px-6">
          <div className="inline-flex items-center gap-3">
            <Image
              src="/deloitte-logo-white.svg"
              alt="Deloitte"
              width={90}
              height={20}
              priority
              className="h-5 w-auto"
            />
            <div className="mx-2 h-4 w-px bg-white/20" />
            <span className="text-sm font-medium tracking-[0.08em] text-white/90">
              Detect and Respond
            </span>
          </div>
          {pathname !== "/login" ? (
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 bg-transparent text-xs text-white/80 hover:bg-white/10 hover:text-white"
                onClick={logout}
              >
                Logout
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="h-[3px] bg-[#86BC25]" />
    </header>
  );
}
