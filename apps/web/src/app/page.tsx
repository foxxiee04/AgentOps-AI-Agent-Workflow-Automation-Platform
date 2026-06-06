import Link from "next/link";
import { ArrowRight, Bot, GitBranch, History, ShieldCheck, Workflow, Zap } from "lucide-react";

const features = [
  { icon: Workflow, title: "Visual workflow builder", detail: "Design agent workflows with trigger, AI, condition, tool, and end nodes." },
  { icon: Bot, title: "Structured AI nodes", detail: "AI steps return schema-validated JSON that downstream nodes can trust." },
  { icon: Zap, title: "Kafka execution", detail: "Workers process long-running AI and tool tasks asynchronously." },
  { icon: History, title: "Run history", detail: "Inspect workflow runs, step outputs, retries, and failures." },
  { icon: ShieldCheck, title: "Workspace controls", detail: "RBAC, audit logs, quotas, and prompt privacy are part of the MVP." },
  { icon: GitBranch, title: "Branching logic", detail: "Route work based on AI scores, confidence, or structured extraction." }
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <nav className="mb-16 flex items-center justify-between lg:mb-20">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#0f9f75] text-sm font-black text-white">AO</span>
              <span className="font-black">AgentOps</span>
            </Link>
            <Link href="/dashboard" className="rounded-md border border-[#dbe5df] bg-white px-4 py-2 text-sm font-bold">
              Dashboard
            </Link>
          </nav>
          <p className="text-sm font-black uppercase text-[#0f8a66]">AI-native workflow automation</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[1.02] tracking-normal text-[#18201f] md:text-7xl">
            AgentOps
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4d5a57]">
            Build, run, and monitor AI-powered workflows with a visual automation builder, structured AI nodes, Kafka workers,
            and SaaS-grade workspace controls.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/workflows/wf_lead_qualification/builder"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#0f9f75] px-5 text-sm font-black text-white"
            >
              Open builder
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/workflows" className="inline-flex h-11 items-center rounded-md border border-[#dbe5df] bg-white px-5 text-sm font-black">
              View workflows
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[#dbe5df] bg-white p-4 shadow-xl shadow-[#18201f]/10">
          <div className="flex items-center justify-between border-b border-[#dbe5df] pb-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#64706d]">Live workflow preview</p>
              <h2 className="mt-1 text-lg font-black">Lead qualification</h2>
            </div>
            <span className="rounded-md bg-[#fff4d8] px-3 py-1 text-xs font-black text-[#98690d]">MVP</span>
          </div>
          <div className="grid gap-3 py-5">
            {["Manual trigger", "AI scores lead", "Condition score > 80", "Webhook mock", "Create follow-up task"].map((step, index) => (
              <div key={step} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-lg bg-[#f7faf7] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-white text-sm font-black text-[#0f9f75] ring-1 ring-[#dbe5df]">
                  {index + 1}
                </span>
                <span className="font-bold">{step}</span>
                <span className="h-2 w-2 rounded-full bg-[#0f9f75]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dbe5df] bg-white px-5 py-14">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-[#dbe5df] bg-[#fbfdfb] p-5">
                <Icon className="h-5 w-5 text-[#e05d47]" />
                <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64706d]">{feature.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

