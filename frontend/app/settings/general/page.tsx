import { GeneralConfig } from "@/components/settings/GeneralConfig";
import { SettingsBreadcrumb } from "@/components/settings/SettingsBreadcrumb";

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-4">
      <SettingsBreadcrumb current="General" />
      <h2 className="text-2xl font-semibold">General Settings</h2>
      <GeneralConfig />
    </div>
  );
}
