# Test Scenarios

End-to-end scenarios for AgentOps and their latest results. The automated scenarios live in `apps/web/e2e` and run with Playwright against a running stack.

## How to run

```bash
pnpm local:docker                         # start the local stack
pnpm --filter @agentops/web test:e2e      # run the 12 scenarios
```

- `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`) and `E2E_API_URL` (default `http://localhost:4000`) point the suite at another environment.
- The suite needs demo login (`@agentops.local` accounts), so it targets local and test stacks, not production.
- The specs run with one worker because the auth endpoints allow 10 requests per minute. Running the suite twice within a minute can hit that limit.
- Each scored lead uses the AI quota (`AI_DAILY_CALL_LIMIT`, default 100 calls per day). When the quota is used up, AI steps fail with `Daily AI quota reached`; raise the limit for the API and the AI worker to keep testing.

## Results — 2026-11-17

Run on 2026-11-17 against the local stack with the new code (Moss Atelier redesign, workspace isolation), on a single run each:

| Suite | Result |
| --- | --- |
| Web unit tests | 106 / 106 passed |
| API, workers and packages unit tests | 310 / 310 passed (API: 194) |
| Integration tests (real Kafka and PostgreSQL) | 10 / 10 passed |
| Playwright end to end | 12 / 12 passed |

One earlier integration run failed with `KafkaJSConnectionError: write after end` while Kafka was still starting; the rerun passed. The redesign required two selector changes: the landing language link is now clicked in the header because the footer has one too, and the login left-panel title is `aria-hidden`, so the page keeps a single heading for the test to match.

Showcase seed on production: 44 runs, 15 approved, 3 rejected, 4 waiting.

## Scenarios

### UI lead flow (`agentops-flow.e2e.ts`)

| ID | Scenario | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| TC-FLOW-01 | Lead flow from login to sales task | Log in; create a workflow from the lead template; publish; run with the sample hot lead; open the run; approve the email in the approval queue; return to the run and the dashboard | Builder shows a valid graph; run reaches "waiting for an email approval"; the input panel shows the masked email only; approval shows "Approved and email sent"; run finishes; `notify-1` is COMPLETED; a "Call lead back within 24 hours" task appears; no page errors | Pass |

### Navigation and access (`navigation.e2e.ts`)

| ID | Scenario | Expected | Result |
| --- | --- | --- | --- |
| TC-NAV-01 | Landing page in English, switch to Vietnamese | Both headlines render; URL changes to `/vi` | Pass |
| TC-NAV-02 | Open the dashboard without a session | Redirect to the login page | Pass |
| TC-NAV-03 | Log in with an account that does not exist | The user stays on the form and sees an error | Pass |
| TC-NAV-04 | Open every app screen after login | Dashboard, Workflows, Runs, Approvals, Agents and Settings render their heading; the sidebar keeps the locale and marks the active section; no page errors | Pass |
| TC-NAV-05 | Dashboard at 390 x 844 | Top navigation is visible; no horizontal overflow | Pass |

### Pipeline through the API (`pipeline-api.e2e.ts`)

| ID | Scenario | Expected | Result |
| --- | --- | --- | --- |
| TC-API-01 | `GET /health/ready` | `ok`; PostgreSQL, Redis and Kafka are `up` | Pass |
| TC-API-02 | `GET /workflows` without a token | 401 | Pass |
| TC-API-03 | Run with a lead that has no email or message | 400 with field errors | Pass |
| TC-API-04 | Spam lead | Scored by `ai-1`; run COMPLETED on branch B; no approval | Pass |
| TC-API-05 | Hot lead, then reject the email | Run waits in WAITING_APPROVAL; after the rejection `email-1` does not run, `notify-1` completes and the run is COMPLETED; a second decision returns 409 | Pass |
| TC-API-06 | Lead message with a prompt-injection attempt | Classified as spam; run COMPLETED without an approval | Pass |

### Showcase seed as a soak test (`scripts/seed-showcase.mjs`)

| Environment | Runs | Outcome |
| --- | --- | --- |
| Production (EKS, MSK, RDS) | 44 leads through the real pipeline | 44 leads scored; 22 took the email path; 15 emails approved, 3 rejected, 4 left waiting; 18 sales tasks created (Grafana "Lead flow" dashboard) |
| Local | 44 leads, twice | Second pass reached the daily AI quota of 100 calls: 23 runs failed with `Daily AI quota reached`, which is the designed behaviour of the quota guard |

## Manual checks

| ID | Check | How |
| --- | --- | --- |
| TC-MAN-01 | Production readiness | `curl https://api.<host>/health/ready` returns `ok` with all dependencies `up` |
| TC-MAN-02 | Metrics are private | `curl https://api.<host>/metrics` returns 404 through the ingress |
| TC-MAN-03 | TLS | The web and API hosts present a valid Let's Encrypt certificate |
| TC-MAN-04 | Scrape targets | Prometheus `/targets` shows two API pods and four workers as `up` |
| TC-MAN-05 | Traces | Grafana Explore with the Tempo data source lists traces for recent runs |

All five were checked on the production cluster on 2026-11-17 and passed.

## Not covered

- Google OAuth login (needs real OAuth credentials).
- OpenAI and Gemini providers (the scenarios use the mock provider).
- Browsers other than Chromium.
- Automated UI tests against production: demo login is disabled there, so the UI suite runs on local and test stacks only.
