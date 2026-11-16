import { promises as fs } from "node:fs";
import path from "node:path";
import { agentTaskCompletedPayloadSchema, createEvent, kafkaTopics } from "@agentops/events";
import {
  defaultLeadScoringOutputSchema,
  estimateAiCostUsd,
  evaluateLeadClassification,
  formatEvaluationMarkdown,
  leadEvaluationCases,
  leadGoldenSetVersion,
  leadScoringSystemPrompt,
  leadScoringUserPromptTemplate,
  type EvaluatedCase,
  type EvaluationReport
} from "@agentops/shared";
import { handleAgentTaskRequested, type AgentTaskDeps } from "./agent-task.handler";

export type RunGoldenSetResult = {
  report: EvaluationReport;
  markdown: string;
  cases: EvaluatedCase[];
};

export type RunGoldenSetOptions = {
  provider: "mock" | "openai";
  model: string;
  providerFactory?: AgentTaskDeps["providerFactory"];
};

export async function runGoldenSet(options: RunGoldenSetOptions): Promise<RunGoldenSetResult> {
  const { provider, model, providerFactory } = options;
  const cases: EvaluatedCase[] = [];

  for (const testCase of leadEvaluationCases) {
    const expected: EvaluatedCase["expected"] = {
      category: String(testCase.expected["category"] ?? "")
    };
    const branch = testCase.expected["branch"];
    if (branch === "A" || branch === "B") {
      expected.branch = branch;
    }

    const event = createEvent({
      type: kafkaTopics.agentTaskRequested,
      workspaceId: "ws_eval",
      workflowRunId: `eval_${testCase.id}`,
      payload: {
        nodeId: "ai-1",
        taskId: `eval_${testCase.id}`,
        input: testCase.input,
        context: testCase.input,
        config: {
          modelProvider: provider,
          modelName: model,
          systemPrompt: leadScoringSystemPrompt,
          userPromptTemplate: leadScoringUserPromptTemplate,
          outputSchema: defaultLeadScoringOutputSchema,
          retryLimit: 1
        }
      }
    });

    const startedAt = Date.now();
    try {
      const completed = await handleAgentTaskRequested(event, { providerFactory });
      const latencyMs = Date.now() - startedAt;
      const payload = agentTaskCompletedPayloadSchema.parse(completed.payload);
      const { inputTokens, outputTokens } = payload.tokenUsage;

      cases.push({
        caseId: testCase.id,
        expected,
        output: payload.output as EvaluatedCase["output"],
        schemaValid: payload.validation.schemaValid,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: estimateAiCostUsd(provider, model, inputTokens, outputTokens)
      });
    } catch {
      cases.push({
        caseId: testCase.id,
        expected,
        output: undefined,
        schemaValid: false,
        latencyMs: Date.now() - startedAt,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0
      });
    }
  }

  const report = evaluateLeadClassification(cases);
  const markdown = formatEvaluationMarkdown(report, { provider, model, goldenSetVersion: leadGoldenSetVersion });

  return { report, markdown, cases };
}

type CliOptions = {
  provider: "mock" | "openai";
  model: string;
  minAccuracy: number;
  maxHotMiss: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { provider: "mock", model: "gpt-4o-mini", minAccuracy: 0.9, maxHotMiss: 0.1 };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === "--provider" && value !== undefined) {
      if (value === "mock" || value === "openai") {
        options.provider = value;
      }
      index += 1;
    } else if (flag === "--model" && value !== undefined) {
      options.model = value;
      index += 1;
    } else if (flag === "--min-accuracy" && value !== undefined) {
      options.minAccuracy = Number(value);
      index += 1;
    } else if (flag === "--max-hot-miss" && value !== undefined) {
      options.maxHotMiss = Number(value);
      index += 1;
    }
  }

  return options;
}

function timestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const hms = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${ymd}-${hms}`;
}

async function main(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  if (options.provider === "openai" && !process.env["OPENAI_API_KEY"]) {
    process.stderr.write("Error: OPENAI_API_KEY is required to run the golden set with the openai provider.\n");
    return 2;
  }

  if (options.provider === "openai") {
    process.stdout.write(`Calls the real OpenAI API for ${leadEvaluationCases.length} cases (costs money)\n`);
  }

  const { report, markdown, cases } = await runGoldenSet({ provider: options.provider, model: options.model });

  const repoRoot = path.resolve(__dirname, "../../..");
  const outputDir = path.join(repoRoot, "reports", "eval");
  await fs.mkdir(outputDir, { recursive: true });

  const baseName = `${timestamp()}-${options.provider}-${options.model}`;
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeFile(jsonPath, JSON.stringify({ report, cases }, null, 2), "utf8");

  process.stdout.write(`${markdown}\n`);
  process.stdout.write(`Wrote report to ${path.relative(repoRoot, markdownPath)} and ${path.relative(repoRoot, jsonPath)}\n`);

  let gateFailed = false;
  if (report.accuracy < options.minAccuracy) {
    process.stderr.write(`Gate failed: accuracy ${report.accuracy} < min-accuracy ${options.minAccuracy}\n`);
    gateFailed = true;
  }
  if (report.hotLeadMissRate > options.maxHotMiss) {
    process.stderr.write(`Gate failed: hotLeadMissRate ${report.hotLeadMissRate} > max-hot-miss ${options.maxHotMiss}\n`);
    gateFailed = true;
  }

  return gateFailed ? 1 : 0;
}

if (typeof require !== "undefined" && require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
