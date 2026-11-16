# Test Plan

What is tested, where, with which data, and what "pass" means. Every level runs without the real OpenAI API: AI nodes use the deterministic `mock` provider unless a run explicitly opts into OpenAI.

## Levels

| Level | Command | Environment | What it proves | Pass criteria |
| --- | --- | --- | --- | --- |
| Unit | `pnpm test` | in-process, no services | Graph execution and branching, condition parser, idempotency/retry/dead-letter, AI retry and token accounting (fake OpenAI SDK), quota, approval RBAC and 409, masking, metrics, UI components | all packages green |
| Static | `pnpm build && pnpm typecheck` | — | Types and builds of all 12 packages | green |
| Golden set | `pnpm eval:leads` (see below) | in-process | Lead classification quality on the labeled golden set | accuracy >= 0.90, hot-lead miss rate <= 0.10, schema-valid rate = 1.0 (mock baseline) |
| Integration | `pnpm test:integration` | docker compose profile `test` (postgres-test :55433, kafka-test :9095, isolated from the dev stack) | Full lead flow with real PostgreSQL + Kafka: trigger -> score -> branch -> approval -> mock email -> sales task; reject; provider outage -> 3 retries -> dead-letter -> run FAILED; RBAC; redelivery ignored; migrations from an empty DB, indexes, unique/FK constraints | 9/9 |
| End-to-end UI | `pnpm test:e2e` | local stack (API, 4 workers, web) | Login -> create workflow from template -> publish -> run -> approve in `/approvals` -> run COMPLETED -> sales task on dashboard; PII masked in the UI | 1/1 |
| Live browser check | Playwright (built-in browser pane) | local stack | Visual check of `/dashboard`, `/approvals`, `/runs/:id`, `/workflows/:id/builder` against `apps/web/DESIGN.md` (cream canvas, mono, hairline, 4px radius), empty/error states with the API stopped | checklist below |
| Container | `pnpm docker:lint`, `pnpm docker:build:apps` | Docker | hadolint clean; images build, run as uid 1000, HEALTHCHECK healthy | lint clean, containers healthy |
| Kubernetes | `pnpm k8s:validate` | Docker (kustomize v5.6.0 + kubeconform v0.6.7) | dev and prod overlays and the migration Job render and match the Kubernetes 1.31 + CRD schemas | 0 invalid |
| Observability | `node scripts/generate-leads.mjs 20 --approve` then Prometheus/Grafana | local stack + compose observability | Dashboards show RED, AI, Kafka, lead-flow data; a forced dead letter fires `AgentOpsDeadLettersIncreasing`; traces in Tempo span API -> workers per node | panels populated, alert firing |
| Load | `pnpm load:leads` (k6, 1000 requests) | local stack, mock provider | Trigger endpoint latency and error rate under load; pipeline drains | p95 < 500 ms, errors < 1 %, all runs reach a terminal or approval state |

## Test Data

- Golden set: `packages/shared/src/lead-eval-dataset.ts` (`leadGoldenSetVersion`), human-labeled `category` and expected `branch` (A = email path for high-intent, B = end). Covers Vietnamese/English, borderline leads, prompt injection, PII in the message, very short and very long messages, job seekers and competitors.
- Change the version string whenever a label changes, and compare reports only within the same version.
- Load and observability runs use `scripts/generate-leads.mjs` / the k6 script: synthetic `@example.com` contacts only.

## Golden-Set Metrics (why these)

| Metric | Why it matters |
| --- | --- |
| Accuracy, macro F1, per-class precision/recall | Overall quality; macro F1 keeps the small `spam` class from being hidden by the large ones |
| Branch accuracy (`leadScore > 80` vs expected branch) | The business decision the workflow actually takes |
| Hot-lead miss rate (expected A, predicted B) | Missed sales opportunities: the costliest error |
| Schema-valid rate, error rate | AI output usable without retries; provider stability |
| p50/p95 latency, tokens, cost total and per lead | Speed and spend per lead, to compare models and prompts |

Run the golden set after every prompt or model change. With `--provider openai` it calls the real API (costs money, needs `OPENAI_API_KEY`); the default is the mock.

## Live Browser Checklist

1. `/dashboard`: metric tiles, scored-leads table (masked emails), sales tasks, runs; `[!]` demo banner absent.
2. `/workflows/:id/builder`: all 8 nodes placed, edges labelled `leadScore > 80` and dashed `else`, "Valid graph".
3. `/runs/:id` of a hot lead: timeline with masked input, output, tokens and model per AI step, status pills; polling stops when the run is finished.
4. `/approvals`: card with lead, assessment, draft email; approve shows the success message; a second decision shows the conflict message.
5. Stop the API: pages show the error state (no demo data unless `NEXT_PUBLIC_DEMO_FALLBACK=true`).
6. `?lang=vi` and `?lang=en` both translated.

## Not Covered Yet

- Real OpenAI quality and latency (needs a key with a spend limit; run the golden set with `--provider openai` once).
- Applying the manifests to a real cluster (only rendered and schema-validated), Terraform and CI/CD (phases 6-7).
- Browser matrix beyond Chromium, accessibility audit with a screen reader.
