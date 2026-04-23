import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityFeedEntry } from "@/types/incident";

export function RecentActivity({ entries }: { entries: ActivityFeedEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No recent activity yet.</p>}
        {entries.map((entry, index) => (
          <div key={entry.id || entry._id || `${entry.timestamp}-${entry.action}-${index}`} className="border-b pb-3 last:border-b-0 last:pb-0">
            <p className="text-sm font-medium">{entry.action}</p>
            <p className="text-sm text-muted-foreground">{entry.message}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
              {entry.incidentNumber ? ` • ${entry.incidentNumber}` : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
