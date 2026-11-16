#!/usr/bin/env node
// Sends demo leads through the lead workflow so dashboards and alerts have data.
// Usage: node scripts/generate-leads.mjs [count=20] [--approve] [--api=http://localhost:4000] [--workflow=wf_lead_qualification]
//        node scripts/generate-leads.mjs 0 --approve   approves every email still waiting in ws_demo
// Only targets a local/dev API; it logs in with a throwaway @agentops.local account.

const args = process.argv.slice(2);
const count = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 20);
const approve = args.includes("--approve");
const api = (args.find((arg) => arg.startsWith("--api="))?.slice(6) ?? process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const workflowId = args.find((arg) => arg.startsWith("--workflow="))?.slice(11) ?? "wf_lead_qualification";

const leads = [
  { name: "Anna Nguyen", company: "Shop ABC", message: "Chúng tôi cần tự động hóa việc trả lời khách hàng qua chat và theo dõi đơn hàng." },
  { name: "Minh Tran", company: "Logistics VN", message: "We need automated order exception handling across 3 warehouses. Please share the API docs." },
  { name: "Lan Pham", company: "Spa Lotus", message: "Just looking around, curious what the product does." },
  { name: "Huy Le", company: "Freelance", message: "Maybe someday, not sure yet if we need it." },
  { name: "Promo Bot", company: "Cheap Deals", message: "Buy cheap pills online, no prescription needed, act now!" },
  { name: "Quang Do", company: "EduTech", message: "Cần CRM tự động phân loại lead từ form và gửi email chào hàng." }
];

async function call(method, path, body, token) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : undefined;
}

const session = await call("POST", "/auth/login", { email: `loadgen-${Date.now()}@agentops.local`, password: "loadgen-pass-123" });
const runs = [];
for (let index = 0; index < count; index += 1) {
  const lead = leads[index % leads.length];
  const slug = lead.name.toLowerCase().replace(/[^a-z]+/g, ".");
  const result = await call("POST", `/workflows/${workflowId}/run`, {
    triggerType: "webhook",
    input: { ...lead, email: `${slug}${index}@example.com`, source: "website_form" }
  }, session.accessToken);
  runs.push(result.run.id);
}
console.log(`Triggered ${runs.length} runs on ${workflowId}.`);

if (approve) {
  // Give the workers time to reach the approval step, then approve everything that is waiting.
  if (count > 0) await new Promise((resolve) => setTimeout(resolve, 8_000));
  const pending = await call("GET", "/workflow-runs/approvals?workspaceId=ws_demo", undefined, session.accessToken);
  let approved = 0;
  const mine = count === 0 ? pending : pending.filter((approval) => runs.includes(approval.workflowRunId));
  for (const item of mine) {
    await call("POST", `/workflow-runs/${item.workflowRunId}/steps/${item.stepId}/approval`, { decision: "approve" }, session.accessToken);
    approved += 1;
  }
  console.log(`Approved ${approved} drafted emails.`);
}
