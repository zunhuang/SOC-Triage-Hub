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
    <aside className="w-64 shrink-0 border-r bg-background/80 p-4">
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
