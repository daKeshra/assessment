import SettingsForm from "@/components/admin/SettingsForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings | Africinnovate Admin" };

export default async function SettingsPage() {
  const settings = await db.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Thresholds, component weights, timer and anti-cheat configuration.
        </p>
      </div>
      <SettingsForm
        settings={settings.map((s) => ({
          key: s.key,
          value: s.value,
          group: s.group,
          label: s.label,
          type: s.type,
          options: s.options,
        }))}
      />
    </div>
  );
}
