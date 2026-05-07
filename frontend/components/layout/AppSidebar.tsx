"use client";

import Link from "next/link";
import { LayoutDashboard, Settings, AlertTriangle, Shield, Search, Code2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useForTriageCount } from "@/hooks/use-incidents";

const QUEUE_NAV_ITEMS = [
  { href: "/soc-triage",    label: "SOC Triage",          icon: AlertTriangle, queueType: "soc_triage",    color: "#86BC25" },
  { href: "/threat-intel",  label: "Threat Intelligence", icon: Shield,        queueType: "threat_intel",  color: "#F59E0B" },
  { href: "/threat-hunt",   label: "Threat Hunt",         icon: Search,        queueType: "threat_hunt",   color: "#EF4444" },
  { href: "/detection-eng", label: "Detection Eng",       icon: Code2,         queueType: "detection_eng", color: "#6366F1" },
];

function QueueNavItem({ item, isActive }: { item: typeof QUEUE_NAV_ITEMS[0]; isActive: boolean }) {
  const Icon = item.icon;
  const count = useForTriageCount(item.queueType);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 border-l-[3px] px-6 py-[11px] text-sm transition-all ${
        isActive
          ? "border-[#86BC25] bg-[rgba(134,188,37,0.10)] font-semibold text-white"
          : "border-transparent text-[#C8C8C8] hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <Icon className={`size-[18px] ${isActive ? "text-[#86BC25]" : "text-[#8C8C8C]"}`} />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 && (
        <span
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-black"
          style={{ backgroundColor: item.color }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  const isDashboard = pathname === "/" || pathname === "/dashboard";
  const isSettings = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <aside className="app-sidebar flex w-60 shrink-0 flex-col bg-[#282728] text-white">
      {/* Navigation section */}
      <div className="px-6 pb-3 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C8C8C]">Navigation</p>
      </div>
      <nav className="space-y-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 border-l-[3px] px-6 py-[11px] text-sm transition-all ${
            isDashboard
              ? "border-[#86BC25] bg-[rgba(134,188,37,0.10)] font-semibold text-white"
              : "border-transparent text-[#C8C8C8] hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          <LayoutDashboard className={`size-[18px] ${isDashboard ? "text-[#86BC25]" : "text-[#8C8C8C]"}`} />
          <span>Dashboard</span>
        </Link>
      </nav>

      {/* Work Queues section */}
      <div className="mt-4 px-6 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C8C8C]">Work Queues</p>
      </div>
      <nav className="space-y-0.5">
        {QUEUE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <QueueNavItem key={item.href} item={item} isActive={isActive} />;
        })}
      </nav>

      {/* Settings section */}
      <div className="mt-4 px-6 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C8C8C]">Settings</p>
      </div>
      <nav className="space-y-0.5">
        <Link
          href="/settings"
          className={`flex items-center gap-3 border-l-[3px] px-6 py-[11px] text-sm transition-all ${
            isSettings
              ? "border-[#86BC25] bg-[rgba(134,188,37,0.10)] font-semibold text-white"
              : "border-transparent text-[#C8C8C8] hover:bg-white/[0.04] hover:text-white"
          }`}
        >
          <Settings className={`size-[18px] ${isSettings ? "text-[#86BC25]" : "text-[#8C8C8C]"}`} />
          <span>Settings</span>
        </Link>
      </nav>

      <div className="mt-auto border-t border-white/[0.06] px-6 py-4 text-[11px] leading-relaxed text-[#6B6B6B]">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#86EB22]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#86EB22]" />
          PROD &middot; us-east-1
        </div>
        Tenant: Deloitte MXDR<br />
        Cyber Digital Analyst
      </div>
    </aside>
  );
}
