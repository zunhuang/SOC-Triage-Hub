import { SSOConfig } from "@/components/settings/SSOConfig";
import { SettingsBreadcrumb } from "@/components/settings/SettingsBreadcrumb";

export default function SSOPage() {
  return (
    <div className="space-y-4">
      <SettingsBreadcrumb current="Single Sign-On" />
      <h2 className="text-2xl font-semibold">Single Sign-On (Azure AD)</h2>
      <SSOConfig />
    </div>
  );
}
