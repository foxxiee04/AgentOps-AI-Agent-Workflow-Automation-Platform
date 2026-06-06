import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Bot, GitBranch, LayoutDashboard, Settings, Workflow } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/workflows/wf_lead_qualification/builder", label: "Builder", icon: GitBranch },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="min-h-screen bg-[#f7faf7] text-[#18201f]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#dbe5df] bg-white/88 px-4 py-5 backdrop-blur lg:block">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0f9f75] text-sm font-black text-white">AO</span>
          <span>
            <span className="block text-sm font-black">AgentOps</span>
            <span className="block text-xs text-[#64706d]">AI workflow control</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  isActive ? "bg-[#e5f6ef] text-[#08785a]" : "text-[#4d5a57] hover:bg-[#eef3ef]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dbe5df] bg-white/86 px-5 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase text-[#64706d]">Workspace</p>
            <p className="text-sm font-black">AgentOps Demo</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-[#dbe5df] bg-white px-3 py-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-[#0f9f75]" />
            Local MVP
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
