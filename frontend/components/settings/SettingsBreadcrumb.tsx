import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SettingsBreadcrumb({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/settings" className="hover:text-foreground hover:underline">Settings</Link>
      <ChevronRight className="size-3" />
      <span className="text-foreground">{current}</span>
    </div>
  );
}
