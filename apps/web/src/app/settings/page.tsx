import { AppShell } from "../../components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell active="Settings">
      <div className="space-y-4 p-5">
        <h1 className="text-3xl font-black">Settings</h1>
        <div className="rounded-lg border border-[#dbe5df] bg-white p-4">
          <p className="text-sm text-[#64706d]">Workspace, RBAC, prompt privacy, API keys, and billing mock settings will live here.</p>
        </div>
      </div>
    </AppShell>
  );
}

