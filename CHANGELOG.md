# Changelog

All notable changes to AgentOps are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); entries are grouped by date because the project has not made a tagged release yet (`package.json` is `0.1.0`). Pull request numbers refer to the repository history.

## [Unreleased]

No changes after 2026-11-18.

## [2026-11-18]

### Added

- Platform admin API and data model (#21): `/admin` statistics (users, active users, workspaces, runs and success rate, AI calls and tokens, approvals, lead categories, signups by provider, 7/30/90-day series, top workspaces), account search/filter/disable/enable/grant-admin, workspace list, platform audit log, and CSV reports for users, workspaces, runs and usage. Adds `User.isPlatformAdmin`, `User.disabledAt`, `User.lastLoginAt`, platform-level `AuditLog` rows and the `platform_admin` migration; admins are bootstrapped from `PLATFORM_ADMIN_EMAILS`, disabled accounts lose access on the next request and have refresh tokens revoked, and admins cannot change their own account.
- Admin console in the web app (#22): overview KPIs and daily charts, CSV export, accounts, workspaces and audit tables, `/admin` route and sidebar entry.
- Premium motion and 3D (#23): WebGL moss workflow sculpture in the landing hero (client-only, paused off-screen, static fallback for reduced motion or no WebGL), 3D tilt and pointer-spotlight cards, magnetic CTAs, scroll parallax, scroll progress and page fade transitions. Motion is disabled for `prefers-reduced-motion` and touch devices.

### Changed

- Runtime images for the API, web and workers no longer ship the bundled `npm` and `corepack` CLIs, which carried HIGH CVEs (#20).
- Exclude design artefacts from GitHub language statistics (#25).

### Fixed

- Route `/admin` on the API host through the ingress, type audit metadata as `unknown`, and make the integration migration test expect every migration folder instead of a fixed list (#26).

### Documentation

- Admin API, account suspension rules, admin setup in production, and the new screenshots (#24).

## [2026-11-17]

### Added

- Moss Atelier UI redesign (#17): new tokens, Playfair Display + Inter Tight + JetBrains Mono typography, warm stone / moss / lime palette, hairline grid, glass navigation, restyled landing, auth, app shell, dashboard, runs, approvals, AI console, settings and workflow builder, plus refreshed screenshots. The direction was selected from MotionSites templates "Agent Hero" and "Moss Island" and documented in `design/design-brief.md`.
- Workspace isolation (#15): `GET /dashboard/*` requires `?workspaceId=` and a `VIEWER` membership, RBAC resolves the workspace from the query parameter, `/auth/me` returns the caller's workspaces, the web app keeps the active workspace in the `agentops_ws` cookie with a sidebar switcher, and first-time Google users get a personal workspace. The production overlay lets new users read the demo workspace as `VIEWER` via `DEMO_WORKSPACE_JOIN_ROLE`.
- Showcase seed that pushes leads through the live pipeline (#12).
- GitHub Actions CI/CD (#11): PR checks (Quality, Integration, Security, Infra, Images), gated dev deploy, gated Terraform plan, and a production deploy that builds seven images and runs the migration job, rollout, smoke test and automatic rollback.
- Kubernetes monitoring stack (#10): Prometheus with alert rules, Alertmanager to the API webhook, five Grafana dashboards, Tempo traces, KEDA autoscaling, dev/prod overlays and a deploy script.
- AWS Terraform environments (#9): network, security, compute and k3s modules; RDS, ElastiCache and MSK; EKS, ECR, app secrets and GitHub OIDC; bootstrap, dev and prod environments plus offline validation.
- Local Docker stack (#8): API, web and worker Dockerfiles, a Compose stack with PostgreSQL, Redis, Kafka and observability, and helper scripts.
- Integration and load testing (#7): real Kafka/PostgreSQL integration suite, k6 load scripts and latency report, Postman collection and manual test guide.
- Initial Lumen web UI (#6): theme, layout, auth flows, leads, runs, approvals, workflows, builder, agents, motion primitives, animated icons and Playwright scenarios.
- Four Kafka workers (#5): workflow orchestration and branching, AI lead scoring and email drafting with a golden-set evaluation, sales task/CRM tools, and notifications.
- API workflow engine (#4): workflow definitions and versions, run lifecycle, webhooks, dashboard aggregates, AI and notification endpoints, health probes and Prometheus metrics.
- Cookie-based auth, Google OAuth and workspace RBAC (#3), with HTTP hardening and infrastructure adapters.
- Shared packages (#2): config, database schema/migrations/seeds, events, observability, shared contracts and UI primitives.
- Workspace tooling and repository checks (#1).

### Changed

- CI generates the Prisma client before lint and typecheck on clean checkouts (#14).
- CI pins `trivy-action` to the v0.36.0 commit and enforces LF for shell scripts (#19).

### Fixed

- Keep shared workspace helpers out of the client module so server components resolve the active workspace correctly (#16).

### Documentation

- System documentation with screenshots (#13), the AWS production runbook and deployment guides (#18), and security/API notes for workspace isolation and Google sign-in (#18).

## [2026-11-16 and earlier]

- Pre-platform history (2026-06-07 to 2026-07-24): first commit, agent profile normalization, monitoring preparation, local settings optimization, and fixes to the local Docker stack and database sync. There were no commits on 2026-11-16; the current platform build began on 2026-11-17.
