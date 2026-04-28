"use client";

import { usePathname, useRouter } from "next/navigation";
import { DEMO_SESSION_KEY } from "@/lib/demo-auth";
import { useAppSettings } from "@/hooks/use-settings";

type PipelineState = "active" | "partial" | "inactive";

function usePipelineState(): PipelineState {
  const { data: settings } = useAppSettings();
  if (!settings) return "inactive";
  const flags = [settings.enableScheduler, settings.autoTriageEnabled, settings.autoPostToJira];
  const onCount = flags.filter(Boolean).length;
  if (onCount === 3) return "active";
  if (onCount > 0) return "partial";
  return "inactive";
}

const stateConfig: Record<PipelineState, { label: string; dotClass: string; pillClass: string }> = {
  active: {
    label: "Autonomous pipeline active",
    dotClass: "bg-[#86EB22] animate-live-pulse",
    pillClass: "border-[rgba(134,235,34,0.24)] bg-[rgba(134,235,34,0.08)] text-[#C9F08A]",
  },
  partial: {
    label: "Pipeline partially active",
    dotClass: "bg-[#E8A317]",
    pillClass: "border-[rgba(232,163,23,0.30)] bg-[rgba(232,163,23,0.08)] text-[#F5D78E]",
  },
  inactive: {
    label: "Analyst Copilot Mode",
    dotClass: "bg-[#6B6B6B]",
    pillClass: "border-white/10 bg-white/[0.04] text-[#999]",
  },
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const pipelineState = usePipelineState();
  const cfg = stateConfig[pipelineState];

  function logout() {
    localStorage.removeItem(DEMO_SESSION_KEY);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="flex h-14 items-center bg-black px-6 text-white">
        <div className="flex items-center gap-3.5">
          <div className="relative grid h-7 w-7 place-items-center rounded bg-white text-base font-bold text-black">
            D<span className="absolute bottom-[-2px] right-1 text-lg font-bold text-[#86BC25]">.</span>
          </div>
          <div className="mx-1 h-[22px] w-px bg-white/[0.18]" />
          <span className="text-[15px] font-semibold text-white">TriageHub</span>
          <span className="text-[13px] font-normal text-[#E6E6E6]/70">Detect and Respond</span>
        </div>

        <div className="flex-1" />

        {pathname !== "/login" && (
          <>
            <div className={`mr-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${cfg.pillClass}`}>
              <span className={`h-[7px] w-[7px] rounded-full ${cfg.dotClass}`} />
              {cfg.label}
            </div>

            <div className="flex cursor-pointer items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.06] py-1 pl-1 pr-2.5 text-[13px] transition-colors hover:bg-white/10">
              <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-gradient-to-br from-[#86BC25] to-[#86EB22] text-[11px] font-bold text-black">
                DA
              </div>
              <span>Digital Analyst</span>
            </div>

            <button
              onClick={logout}
              className="ml-3 rounded-md border border-white/20 bg-transparent px-3.5 py-1.5 text-[13px] text-white/80 transition-all hover:border-white/35 hover:bg-white/[0.08] hover:text-white"
            >
              Logout
            </button>
          </>
        )}
      </div>
      <div className="h-[3px] bg-[#86BC25]" />
    </header>
  );
}
