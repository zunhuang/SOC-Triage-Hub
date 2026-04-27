"use client";

import Link from "next/link";
import { LayoutDashboard, OctagonAlert, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: OctagonAlert },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppSidebar() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="w-56 shrink-0 bg-[#282728] text-gray-300">
      <div className="px-4 pb-2 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">Navigation</p>
      </div>
      <nav className="space-y-0.5 px-2">
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
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "border-l-2 border-[#86BC25] bg-white/5 font-medium text-white"
                  : "border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`size-4 ${isActive ? "text-[#86BC25]" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
