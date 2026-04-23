import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pages = [
  { href: "/settings/agents", title: "Kindo Agents", description: "Enable and choose triage agents" },
  { href: "/settings/jira", title: "Jira Data Center", description: "Configure instance, JQL, and polling" },
  { href: "/settings/general", title: "General", description: "LLM provider and runtime settings" }
];

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {pages.map((page) => (
          <Link key={page.href} href={page.href}>
            <Card className="h-full transition-colors hover:border-primary/70">
              <CardHeader>
                <CardTitle>{page.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{page.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
