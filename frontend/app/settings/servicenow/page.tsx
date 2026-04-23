import { ServiceNowConfig } from "@/components/settings/ServiceNowConfig";
import { SettingsBreadcrumb } from "@/components/settings/SettingsBreadcrumb";

export default function ServiceNowPage() {
  return (
    <div className="space-y-4">
      <SettingsBreadcrumb current="ServiceNow" />
      <h2 className="text-2xl font-semibold">ServiceNow Configuration</h2>
      <ServiceNowConfig />
    </div>
  );
}
