import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = { minutes: 30, container: "agentops-local-postgres" };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--minutes") {
      args.minutes = argv[++i];
    } else if (arg.startsWith("--minutes=")) {
      args.minutes = arg.slice("--minutes=".length);
    } else if (arg === "--container") {
      args.container = argv[++i];
    } else if (arg.startsWith("--container=")) {
      args.container = arg.slice("--container=".length);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error("Usage: node scripts/report-run-latency.mjs [--minutes <n>] [--container <name>]");
      process.exit(1);
    }
  }

  const minutes = Number(args.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    console.error(`--minutes must be a positive integer, received: ${args.minutes}`);
    process.exit(1);
  }

  if (typeof args.container !== "string" || args.container.length === 0) {
    console.error("--container must be a non-empty string");
    process.exit(1);
  }

  return { minutes, container: args.container };
}

const { minutes, container } = parseArgs(process.argv.slice(2));
const windowExpr = `now() - interval '${minutes} minutes'`;

function runSql(sql) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "agentops",
      "-d",
      "agentops",
      "-At",
      "-F",
      "|",
      "-c",
      sql
    ],
    { encoding: "utf8" }
  );

  if (result.error) {
    console.error(`Failed to run docker exec: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    console.error(`psql exited with code ${result.status}${stderr ? `:\n${stderr}` : ""}`);
    process.exit(1);
  }

  return result.stdout ?? "";
}

function parseTable(stdout, columns) {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = [];
      let rest = line;
      for (let i = 0; i < columns.length - 1; i++) {
        const idx = rest.indexOf("|");
        if (idx === -1) {
          parts.push(rest);
          rest = "";
        } else {
          parts.push(rest.slice(0, idx));
          rest = rest.slice(idx + 1);
        }
      }
      parts.push(rest);
      return Object.fromEntries(columns.map((column, i) => [column, parts[i] ?? ""]));
    });
}

function formatSeconds(value) {
  const num = Number(value);
  if (value === "" || value === null || value === undefined || Number.isNaN(num)) {
    return "n/a";
  }
  return `${num.toFixed(2)}s`;
}

function formatCount(value) {
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : String(num);
}

const minutesLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;

const statusRows = parseTable(
  runSql(
    `select status, count(*) from "WorkflowRun" where "createdAt" >= ${windowExpr} group by status order by status;`
  ),
  ["status", "count"]
);

const latencyRows = parseTable(
  runSql(
    `select percentile_cont(0.5) within group (order by extract(epoch from ("finishedAt" - "createdAt"))) as p50, percentile_cont(0.95) within group (order by extract(epoch from ("finishedAt" - "createdAt"))) as p95, max(extract(epoch from ("finishedAt" - "createdAt"))) as max from "WorkflowRun" where status = 'COMPLETED' and "finishedAt" is not null and "createdAt" >= ${windowExpr};`
  ),
  ["p50", "p95", "max"]
);

const approvalRows = parseTable(
  runSql(
    `select percentile_cont(0.5) within group (order by extract(epoch from (a."requestedAt" - r."createdAt"))) as p50, percentile_cont(0.95) within group (order by extract(epoch from (a."requestedAt" - r."createdAt"))) as p95 from "HumanApproval" a join "WorkflowRun" r on r.id = a."workflowRunId" where r."createdAt" >= ${windowExpr};`
  ),
  ["p50", "p95"]
);

const failedCountRows = parseTable(
  runSql(
    `select count(*) from "WorkflowRun" where status = 'FAILED' and "createdAt" >= ${windowExpr};`
  ),
  ["count"]
);

const errorRows = parseTable(
  runSql(
    `select coalesce("errorMessage", '(no message)') as "errorMessage", count(*) as count from "WorkflowRun" where status = 'FAILED' and "createdAt" >= ${windowExpr} group by "errorMessage" order by count desc, "errorMessage" asc limit 5;`
  ),
  ["errorMessage", "count"]
);

const outcomeRows = parseTable(
  runSql(
    `select "consumerGroup", outcome, count(*) as count from "ProcessedMessage" where "processedAt" >= ${windowExpr} group by "consumerGroup", outcome order by "consumerGroup" asc, outcome asc;`
  ),
  ["consumerGroup", "outcome", "count"]
);

const latency = latencyRows[0] ?? { p50: "", p95: "", max: "" };
const approval = approvalRows[0] ?? { p50: "", p95: "" };
const failedCount = failedCountRows[0]?.count ?? "0";

const lines = [];

lines.push(`# Run latency report (last ${minutesLabel})`);
lines.push("");
lines.push(`Container: \`${container}\``);
lines.push("");

lines.push(`## 1. Runs created (grouped by status)`);
lines.push("");
if (statusRows.length === 0) {
  lines.push("_No runs created in the window._");
} else {
  lines.push("| Status | Count |");
  lines.push("| --- | --- |");
  for (const row of statusRows) {
    lines.push(`| ${row.status} | ${formatCount(row.count)} |`);
  }
}
lines.push("");

lines.push(`## 2. End-to-end latency (COMPLETED runs, seconds)`);
lines.push("");
lines.push("| p50 | p95 | max |");
lines.push("| --- | --- | --- |");
lines.push(`| ${formatSeconds(latency.p50)} | ${formatSeconds(latency.p95)} | ${formatSeconds(latency.max)} |`);
lines.push("");

lines.push(`## 3. Time to approval (runs that reached HUMAN_APPROVAL, seconds)`);
lines.push("");
lines.push("| p50 | p95 |");
lines.push("| --- | --- |");
lines.push(`| ${formatSeconds(approval.p50)} | ${formatSeconds(approval.p95)} |`);
lines.push("");

lines.push(`## 4. Failed runs`);
lines.push("");
lines.push(`Failed runs in the window: ${formatCount(failedCount)}`);
lines.push("");
if (errorRows.length === 0) {
  lines.push("_No failed runs in the window._");
} else {
  lines.push("| errorMessage | Count |");
  lines.push("| --- | --- |");
  for (const row of errorRows) {
    lines.push(`| ${row.errorMessage} | ${formatCount(row.count)} |`);
  }
}
lines.push("");

lines.push(`## 5. Processed message outcomes (grouped by consumerGroup, outcome)`);
lines.push("");
if (outcomeRows.length === 0) {
  lines.push("_No processed messages in the window._");
} else {
  lines.push("| consumerGroup | outcome | Count |");
  lines.push("| --- | --- | --- |");
  for (const row of outcomeRows) {
    lines.push(`| ${row.consumerGroup} | ${row.outcome} | ${formatCount(row.count)} |`);
  }
}
lines.push("");

console.log(lines.join("\n"));
