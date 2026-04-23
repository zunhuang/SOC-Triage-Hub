import { KindoConfig } from "@/components/settings/KindoConfig";
import { AgentSelector } from "@/components/settings/AgentSelector";
import { SettingsBreadcrumb } from "@/components/settings/SettingsBreadcrumb";

export default function AgentsPage() {
  return (
    <div className="space-y-4">
      <SettingsBreadcrumb current="Kindo Agents" />
      <h2 className="text-2xl font-semibold">Kindo Agents</h2>
      <KindoConfig />
      <AgentSelector />
    </div>
  );
}
