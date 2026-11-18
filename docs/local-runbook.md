# Local Operations Runbook

This guide provides instructions for configuring, running, testing, and troubleshooting AgentOps locally on developer workstations.

Related documentation:
- [Deployment and CI/CD](deployment.md): Architecture overview and CI/CD automation.
- [Operations Runbook](runbook.md): Production incident playbooks and operational procedures.
- [Test Plan](test-plan.md): Quality gates and test execution strategies.

---

## 1. Prerequisites and Toolchain Setup

Ensure the host environment satisfies the following minimum requirements:

| Tool | Required Version | Verification Command |
| --- | --- | --- |
| **Node.js** | `>=22.0.0` | `node --version` |
| **pnpm** | `11.5.2` (or `>=11.0.0`) | `pnpm --version` |
| **Docker** | Docker Desktop or Docker Engine with Compose V2 | `docker --version` |

### Initial Repository Setup
Run the following commands in the root of the repository:

```bash
# 1. Install dependencies across monorepo workspaces
pnpm install

# 2. Initialize local environment file (if not already present)
cp .env.example .env
```

---

## 2. Ports Allocation Reference

All local port bindings across developer tooling, backing infrastructure, and test profiles are mapped in the following table:

| Service / Workload | Host Port | Container / Internal Port | Protocol | Purpose |
| --- | --- | --- | --- | --- |
| **Web App** | `3000` | `3000` | HTTP | Next.js 16 frontend and React Flow builder |
| **API Server** | `4000` | `4000` | HTTP | NestJS API, Swagger docs, health endpoints |
| **PostgreSQL (Dev)** | `55432` | `5432` | TCP | Local development database (`agentops`) |
| **PostgreSQL (Test)** | `55433` | `5432` | TCP | Isolated database for integration tests (`profile: test`) |
| **Redis** | `6379` | `6379` | TCP | Rate limiting and session caching |
| **Kafka (Dev External)** | `9094` | `9094` | TCP | Host access for local development producers/consumers |
| **Kafka (Dev Internal)** | — | `9092` | TCP | In-docker network communication between containers |
| **Kafka (Test External)**| `9095` | `9095` | TCP | Isolated Kafka broker for integration tests (`profile: test`)|
| **Prometheus** | `9090` | `9090` | HTTP | Local metrics collection and rule evaluation |
| **Alertmanager** | `9093` | `9093` | HTTP | Local alert routing and webhook testing |
| **Grafana** | `3001` | `3000` | HTTP | Provisioned dashboards (Credentials: `agentops` / `agentops`)|
| **Tempo (HTTP / UI)** | `3200` | `3200` | HTTP | Tempo query interface |
| **Tempo (OTLP gRPC)** | `4317` | `4317` | gRPC | OpenTelemetry trace export (gRPC) |
| **Tempo (OTLP HTTP)** | `4318` | `4318` | HTTP | OpenTelemetry trace export (HTTP protobuf/JSON) |
| **workflow-worker metrics**| `4101` | `9100` | HTTP | Prometheus metrics endpoint for workflow worker |
| **ai-worker metrics** | `4102` | `9100` | HTTP | Prometheus metrics endpoint for AI worker |
| **tool-worker metrics** | `4103` | `9100` | HTTP | Prometheus metrics endpoint for tool worker |
| **notification-worker metrics**| `4104` | `9100` | HTTP | Prometheus metrics endpoint for notification worker |

---

## 3. Running the Platform Locally

Developers can choose between two operational modes depending on whether they are developing application code (Mode A) or running the complete containerized stack (Mode B).

### Mode A: Native Dev with Dockerized Infrastructure (Recommended for Coding)

In this mode, supporting data services (Postgres, Redis, Kafka, Observability) run in Docker, while Node.js applications run natively with fast hot reloading:

```bash
# 1. Start Docker backing services and run migrations, seeds, and topic bootstrap
pnpm local:up

# 2. Start all applications concurrently (web, api, workers)
pnpm dev
```

Alternatively, run specific components in dedicated terminal tabs:

```bash
# Terminal 1: Backend API
pnpm dev:api

# Terminal 2: Frontend Web App
pnpm dev:web

# Terminal 3: All 4 Background Workers
pnpm dev:workers

# (Optional) Individual worker filtering:
pnpm --filter @agentops/workflow-worker dev
pnpm --filter @agentops/ai-worker dev
pnpm --filter @agentops/tool-worker dev
pnpm --filter @agentops/notification-worker dev
```

### Mode B: Full Container Stack (Docker Compose Apps)

Runs the entire product stack (including frontend, backend, and all four workers) in Docker containers, mirroring the production container topology:

```bash
# Build and run the complete containerized stack in the background
pnpm local:docker

# Stream logs from application containers
pnpm compose:apps:logs

# Stop application containers
pnpm compose:apps:down

# Reset database volumes and re-seed all containers
pnpm compose:apps:reset
```

---

## 4. Test Execution Commands

Execute tests locally matching the CI/CD pipeline targets:

```bash
# 1. Run all monorepo unit tests
pnpm test

# 2. Run unit tests by workspace filter
pnpm test:api
pnpm test:web
pnpm test:workers

# 3. Static typechecking and linting
pnpm typecheck
pnpm lint

# 4. Run integration tests (automatically starts postgres-test and kafka-test)
pnpm test:integration

# 5. Run Playwright end-to-end tests against local running stack
pnpm test:e2e

# 6. Evaluate lead qualification golden set
pnpm eval:leads
```

---

## 5. Local Smoke Test Verification

Execute this step-by-step verification checklist to confirm local platform health.

### TC-01: Verify Docker Infrastructure Health
```bash
docker compose ps
```
*Expected*: Containers `agentops-local-postgres`, `agentops-local-redis`, and `agentops-local-kafka` report `healthy` or `running`.

### TC-02: Verify API Process Liveness
```bash
curl -s http://localhost:4000/health/live
```
*Expected Response*:
```json
{"status":"ok"}
```

### TC-03: Verify API Dependency Readiness
```bash
curl -s http://localhost:4000/health/ready
```
*Expected Response*:
```json
{
  "status": "ok",
  "info": {
    "postgres": {"status": "up"},
    "redis": {"status": "up"},
    "kafka": {"status": "up"}
  }
}
```

### TC-04: Verify Web Application Access
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en
```
*Expected*: HTTP Status `200`.

### TC-05: Register Local User Account
```bash
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev-user@example.com","password":"password123","name":"Local Developer"}'
```
*Expected*: Returns JSON with `user`, `accessToken`, and `refreshToken`.

### TC-06: Verify Authenticated Session
```bash
curl -s http://localhost:4000/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
*Expected*: Returns user object with email `dev-user@example.com` and associated workspace.

### TC-07: List Workflows
```bash
curl -s http://localhost:4000/workflows \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
*Expected*: Returns array containing demo workflow `wf_lead_qualification`.

### TC-08: Trigger Workflow Execution
```bash
curl -s -X POST http://localhost:4000/workflows/wf_lead_qualification/run \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "triggerType": "manual",
    "input": {
      "lead": {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "company": "Acme Corp",
        "message": "Interested in evaluating enterprise AI workflow automation."
      }
    }
  }'
```
*Expected*: Returns run object with `status: "PENDING"` and emits event `workflow-triggered`.

### TC-09: Verify Scrape Metrics Endpoints
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/metrics
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4101/metrics
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4102/metrics
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4103/metrics
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4104/metrics
```
*Expected*: All return HTTP `200`.

---

## 6. Local Troubleshooting Guide

### Port Collisions
If ports 3000, 4000, or 55432 are already bound by orphan processes:
```bash
# On Linux / macOS:
lsof -i :3000 -i :4000 -i :55432

# On Windows PowerShell:
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,4000,55432 }
```
Terminate orphan node processes before re-running `pnpm dev`.

### Docker Desktop Daemon Pipe Errors
If encountering:
```txt
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```
Docker Desktop is not currently running. Start Docker Desktop from the system menu and wait until the daemon reports `Running` before executing Docker or Compose commands.

### Kafka Bootstrap and Topic Initialization
If the API fails readiness due to missing Kafka topics:
```bash
pnpm kafka:bootstrap
```
*This command runs against `localhost:9094` and creates the required topics with 3 partitions and a replication factor of 1.*

### Resetting Local State
To completely flush local PostgreSQL tables, Kafka logs, and Redis cache:
```bash
# Stop containers and remove volumes
pnpm compose:down -v

# Re-initialize clean environment
pnpm local:up
```
