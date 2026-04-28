"use client";

import Link from "next/link";
import { LayoutDashboard, OctagonAlert, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useForTriageCount } from "@/hooks/use-incidents";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: OctagonAlert },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppSidebar() {
  const pathname = usePathname();
  const forTriageCount = useForTriageCount();

  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="app-sidebar flex w-60 shrink-0 flex-col bg-[#282728] text-white">
      <div className="px-6 pb-3 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C8C8C]">Navigation</p>
      </div>
      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 border-l-[3px] px-6 py-[11px] text-sm transition-all ${
                isActive
                  ? "border-[#86BC25] bg-[rgba(134,188,37,0.10)] font-semibold text-white"
                  : "border-transparent text-[#C8C8C8] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon className={`size-[18px] ${isActive ? "text-[#86BC25]" : "text-[#8C8C8C]"}`} />
              <span>{item.label}</span>
              {item.label === "Incidents" && forTriageCount > 0 && (
                <span className="ml-auto rounded-full bg-[#86BC25] px-[7px] py-px text-[11px] font-bold text-black">
                  {forTriageCount}
                </span>
              )}
            </Link>
          );
        })}
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
