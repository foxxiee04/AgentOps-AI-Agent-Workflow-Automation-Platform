import { AppShell } from "../../components/app-shell";

export default function AgentsPage() {
  return (
    <AppShell active="Agents">
      <div className="space-y-4 p-5">
        <h1 className="text-3xl font-black">Agents</h1>
        <div className="rounded-lg border border-[#dbe5df] bg-white p-4">
          <p className="text-sm text-[#64706d]">AI Agent configs will be managed here after the workflow MVP is wired to persistence.</p>
        </div>
      </div>
    </AppShell>
  );
}

