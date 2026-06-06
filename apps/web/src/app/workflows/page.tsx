import Link from "next/link";
import { Bot, GitBranch, MoreHorizontal, Play, Workflow } from "lucide-react";
import { AppShell } from "../../components/app-shell";

const workflows = [
  {
    id: "wf_lead_qualification",
    name: "Lead qualification",
    status: "DRAFT",
    description: "Score a new lead, branch by intent, and trigger follow-up actions.",
    nodes: 5
  }
];

export default function WorkflowsPage() {
  return (
    <AppShell active="Workflows">
      <div className="space-y-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-[#0f8a66]">Automation</p>
            <h1 className="mt-1 text-3xl font-black">Workflows</h1>
          </div>
          <Link href="/workflows/wf_lead_qualification/builder" className="rounded-md bg-[#0f9f75] px-4 py-2 text-sm font-black text-white">
            New workflow
          </Link>
        </div>

        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <article key={workflow.id} className="rounded-lg border border-[#dbe5df] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e5f6ef] text-[#08785a]">
                    <Workflow className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">{workflow.name}</h2>
                      <span className="rounded-md bg-[#fff4d8] px-2 py-1 text-xs font-black text-[#98690d]">{workflow.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#64706d]">{workflow.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#4d5a57]">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f7faf7] px-2 py-1">
                        <Bot className="h-3.5 w-3.5" />
                        AI node
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f7faf7] px-2 py-1">
                        <GitBranch className="h-3.5 w-3.5" />
                        Condition
                      </span>
                      <span className="rounded-md bg-[#f7faf7] px-2 py-1">{workflow.nodes} nodes</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/workflows/${workflow.id}/builder`}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#dbe5df] bg-white px-3 text-sm font-black"
                  >
                    <Play className="h-4 w-4" />
                    Builder
                  </Link>
                  <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-[#dbe5df] bg-white">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

