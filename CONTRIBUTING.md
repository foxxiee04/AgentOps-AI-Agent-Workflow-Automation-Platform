# Contributing to AgentOps

This repository is a portfolio project, but it follows the same workflow a small product team would use: short-lived branches, conventional change messages, pull requests into `main`, and CI checks that must pass before merge.

## Before you start

Read the documents that match the area you are changing:

- [README.md](README.md) for the product and local quick start.
- [docs/system-documentation.md](docs/system-documentation.md) for the architecture.
- [docs/local-runbook.md](docs/local-runbook.md) for local commands and smoke tests.
- [design/design-brief.md](design/design-brief.md) for the Moss Atelier design system (web/UI work).

Required toolchain: Node.js 22, pnpm 11.5.2 (the `packageManager` field pins it), Docker Desktop for the local infrastructure.

## Branch naming

Create a branch from an up-to-date `main` using one of these prefixes:

| Prefix   | Use for                                       | Example                          |
| -------- | --------------------------------------------- | -------------------------------- |
| `feat/`  | New user-facing or platform capability        | `feat/admin-console-web`         |
| `fix/`   | Bug, security or correctness fix              | `fix/runtime-images-without-npm` |
| `docs/`  | Documentation only                            | `docs/moss-atelier-workspaces`   |
| `chore/` | Tooling, dependencies, repository maintenance | `chore/linguist-design-docs`     |
| `ci/`    | CI/CD workflows and build pipeline            | `ci/cicd-pipeline`               |
| `test/`  | Test coverage and test infrastructure         | `test/integration-load`          |

Keep the slug short and descriptive. Use `/` only to separate the prefix from the slug, and avoid spaces.

## Change messages

Write subjects in the conventional style, with a type, an optional scope, and an imperative summary:

```txt
feat(admin): admin module with overview statistics, accounts, workspaces, audit and CSV reports
fix(ci): pin trivy-action to the v0.36.0 commit and keep shell scripts LF
docs(web): describe Moss Atelier in DESIGN.md and README
chore(compose): make the local operator account a platform admin
test(integration): expect every migration folder instead of a fixed list
build(web): add three.js and React Three Fiber
```

Allowed types are `feat`, `fix`, `docs`, `chore`, `ci`, `test` and `build`. Common scopes in this repository are `api`, `web`, `admin`, `auth`, `db`, `k8s`, `terraform`, `docker`, `compose`, `ci`, `integration` and `design`. Use the body to explain why the change exists, what behavior changed, and any migration or configuration step. Mention the affected app or package by name.

## Pull request flow

1. Open a pull request into `main` with a title that matches the change-message style.
2. Describe the change, the user-visible effect, and how you verified it. Include screenshots for UI changes and the relevant command output for behavioral changes.
3. Keep the pull request focused. Split unrelated refactors, UI polish and infrastructure changes into separate PRs.
4. Wait for the PR checks, then address review comments with additional commits. Do not rewrite published history to hide review work.
5. The maintainer merges the PR into `main`; do not merge your own changes.

### PR checks

`.github/workflows/ci.yml` runs on every pull request:

| Job         | What it checks                                                              |
| ----------- | --------------------------------------------------------------------------- |
| Quality     | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm eval:leads` |
| Integration | Real Kafka and PostgreSQL via `pnpm test:integration`                       |
| Security    | `pnpm audit --prod --audit-level high` and gitleaks                         |
| Infra       | actionlint, shellcheck, hadolint, kubeconform and `terraform validate`      |
| Images      | Six images built and scanned by Trivy; the CRITICAL/HIGH gate fails the job |

The production workflow builds seven images (api, tools, web and four workers) and runs only on `main` or a manual dispatch. A documentation-only change still goes through the PR checks.

## Local checks before opening a PR

Run from the repository root:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm eval:leads
```

The integration suite starts the `postgres-test` and `kafka-test` Compose services by itself. The Playwright suite needs the local stack running; install browsers once with `pnpm exec playwright install`.

For infrastructure changes, also run:

```bash
pnpm docker:lint
pnpm k8s:validate
pnpm tf:validate
pnpm ci:lint
```

If a command cannot run in your environment (for example, no Docker daemon), say so in the PR instead of claiming it passed.

## Adding a Prisma migration

The Prisma schema is in `packages/database/prisma/schema.prisma`; migrations live in `packages/database/prisma/migrations/`.

1. Edit the schema.
2. Create a named migration against the local database:

   ```bash
   pnpm --filter @agentops/database exec prisma migrate dev --schema prisma/schema.prisma --name <change_name>
   ```

   The root shortcut `pnpm db:migrate` runs the same command and prompts for a name.

3. Review the generated SQL. Check that indexes, unique constraints and cascade rules match the data model.
4. Regenerate the client and apply the migration locally:

   ```bash
   pnpm db:generate
   pnpm db:migrate:deploy
   ```

5. Run `pnpm test:integration`. The integration suite reads the migrations folder and applies every migration, so a migration that is missing, unordered or broken fails there.
6. Commit both the schema change and the whole new migration folder. Never edit a migration that has already been merged.

Seeds are `pnpm db:seed` (required reference/demo data) and `pnpm db:seed:demo` (showcase data). `pnpm db:reset` recreates the local database; treat it as destructive.

## Coding conventions

These rules are visible in the current codebase and apply to new work:

- **TypeScript strict.** `tsconfig.base.json` sets `strict: true`; do not add `any` to work around a type. The web app, API, workers and packages all typecheck with `tsc --noEmit`.
- **Validate at the boundaries.** Environment configuration is parsed with zod in `packages/config`. Shared event and workflow contracts are zod schemas in `packages/shared` and `packages/events`. API request DTOs use `class-validator`.
- **Respect module boundaries.** The API is a NestJS modular monolith: controllers handle HTTP, services hold domain logic, and database access goes through `@agentops/database`. Workers consume and publish typed Kafka envelopes from `@agentops/events`.
- **Tests next to the code.** Unit tests use Vitest and live beside the file they cover (`*.test.ts`), for example `apps/api/src/modules/auth/auth.service.test.ts`. Integration tests live in `packages/integration-tests`; Playwright scenarios live in `apps/web/e2e`.
- **Reuse the shared packages.** Do not duplicate env parsing, event types, workflow graph types, metrics helpers or UI primitives that already exist in `packages/*`.
- **Keep the UI in the design system.** Use the tokens, typography and motion rules in [design/design-brief.md](design/design-brief.md) rather than introducing new colors, fonts or animation libraries.
- **Prefer clear failure over silent fallback.** The web app may fall back to demo data only when explicitly enabled; API and worker errors must be visible in the run timeline and logs.
- **Do not commit secrets.** Local values go in `.env` (gitignored); production secrets live in AWS Secrets Manager and reach pods through External Secrets. CI runs gitleaks for a reason.
- **No generated artifacts from tooling** unless the build requires them; the checked-in Prisma client under `packages/database/src/generated` is the exception.

## Documentation changes

Keep documents in English, concrete and free of marketing language. Use Markdown tables and Mermaid diagrams when they clarify behavior. Every relative link must point to a file that exists, and screenshots belong in `docs/images/app` or `docs/images/portfolio`. If you change a command, a port, a test count or an architecture decision, update the document that states it in the same pull request.
