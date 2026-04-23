import { JiraConfig } from "@/components/settings/JiraConfig";
import { SettingsBreadcrumb } from "@/components/settings/SettingsBreadcrumb";

export default function JiraPage() {
  return (
    <div className="space-y-4">
      <SettingsBreadcrumb current="Jira Data Center" />
      <h2 className="text-2xl font-semibold">Jira Data Center Configuration</h2>
      <JiraConfig />
    </div>
  );
}
