# Local Runbook

File này dùng để chạy AgentOps trên máy local và test nhanh các chức năng chính.

Các lệnh bên dưới dùng PowerShell tại thư mục gốc repo:

```powershell
cd "E:\AgentOps — AI Agent Workflow Automation Platform"
```

## 1. Yêu cầu máy

Kiểm tra toolchain:

```powershell
node --version
pnpm --version
docker --version
```

Phiên bản khuyến nghị:

| Tool | Version |
| --- | --- |
| Node.js | `>=22.0.0` |
| pnpm | `>=11.0.0` |
| Docker | Docker Desktop hoặc Docker Engine |

## 2. Cấu hình môi trường

Tạo file `.env` từ template:

```powershell
Copy-Item .env.example .env
```

Các biến quan trọng:

| Biến | Công dụng | Local default |
| --- | --- | --- |
| `DATABASE_URL` | Kết nối PostgreSQL | `postgresql://agentops:agentops@localhost:55432/agentops` |
| `REDIS_URL` | Kết nối Redis | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Broker Kafka cho API/worker | `localhost:9094` |
| `WEB_APP_URL` | URL frontend | `http://localhost:3000` |
| `API_URL` | URL backend API | `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL` | API URL cho Next.js client | `http://localhost:4000` |
| `OPENAI_API_KEY` | Optional, dùng khi test AI provider thật | rỗng |
| `GEMINI_API_KEY` | Optional, dùng khi test Gemini provider | rỗng |

Nếu không có AI key, hệ thống vẫn test được bằng mock/local flow.

## 3. Start Docker infrastructure

Chạy toàn bộ local infrastructure:

```powershell
pnpm compose:up
```

Lệnh này tương đương:

```powershell
docker compose up -d
```

Các service được bật:

| Service | URL/Port | Công dụng |
| --- | --- | --- |
| PostgreSQL | `localhost:55432` | Database chính |
| Redis | `localhost:6379` | Cache/status/rate-limit |
| Kafka | `localhost:9094` | Event queue cho workflow/worker |
| Prometheus | `http://localhost:9090` | Metrics |
| Grafana | `http://localhost:3001` | Dashboard, login `agentops` / `agentops` |
| Alertmanager | `http://localhost:9093` | Alert routing |
| Tempo | `http://localhost:3200` | Trace backend |

Kiểm tra container:

```powershell
docker compose ps
```

Nếu chỉ muốn chạy phần bắt buộc cho app, dùng:

```powershell
docker compose up -d postgres redis kafka
```

## 4. Sync database và Kafka topics

Đẩy Prisma schema vào PostgreSQL local:

```powershell
pnpm db:push
```

Tạo Kafka topics nếu thiếu:

```powershell
pnpm kafka:bootstrap
```

Kết quả Kafka bootstrap mong muốn:

```txt
totalConfigured: 13
```

## 5. Start backend, frontend, workers

Trước khi start dev stack, kiểm tra các port app có đang bị process cũ giữ không:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3000,4000,4101,4102,4103,4104 }
```

Nếu command trên có kết quả, nghĩa là app hoặc worker đang chạy rồi. Không chạy thêm dev stack thứ hai trên cùng port; mở URL để test luôn hoặc stop terminal cũ bằng `Ctrl+C`.

### Cách 1: chạy toàn bộ dev stack

Do repo có nhiều persistent dev tasks, dùng concurrency rõ ràng:

```powershell
pnpm dev
```

Lệnh này chạy:

| Package | Vai trò |
| --- | --- |
| `@agentops/web` | Frontend Next.js tại `http://localhost:3000` |
| `@agentops/api` | Backend NestJS tại `http://localhost:4000` |
| `@agentops/workflow-worker` | Consume `workflow-triggered` |
| `@agentops/ai-worker` | Consume `agent-task-requested` |
| `@agentops/tool-worker` | Consume `tool-call-requested` |
| `@agentops/notification-worker` | Consume `notification-requested` |
| `packages/*` | Shared packages ở watch mode |

### Cách 2: chạy từng phần

Nếu chạy từng phần thay vì `pnpm dev`, build shared packages một lần trước:

```powershell
pnpm build:packages
```

Backend API:

```powershell
pnpm --filter @agentops/api dev
```

Frontend web:

```powershell
pnpm --filter @agentops/web dev
```

Workflow worker:

```powershell
pnpm --filter @agentops/workflow-worker dev
```

AI worker:

```powershell
pnpm --filter @agentops/ai-worker dev
```

Tool worker:

```powershell
pnpm --filter @agentops/tool-worker dev
```

Notification worker:

```powershell
pnpm --filter @agentops/notification-worker dev
```

## 6. URL để test thủ công

| Mục | URL |
| --- | --- |
| Web app | `http://localhost:3000` |
| API Swagger | `http://localhost:4000/docs` |
| API liveness | `http://localhost:4000/health/live` |
| API readiness | `http://localhost:4000/health/ready` |
| API metrics | `http://localhost:4000/metrics` |
| Workflow worker metrics | `http://localhost:4101/metrics` |
| AI worker metrics | `http://localhost:4102/metrics` |
| Tool worker metrics | `http://localhost:4103/metrics` |
| Notification worker metrics | `http://localhost:4104/metrics` |
| Grafana | `http://localhost:3001` |
| Prometheus | `http://localhost:9090` |

## 7. Test commands

Chạy typecheck toàn repo:

```powershell
pnpm typecheck
```

Chạy unit tests toàn repo:

```powershell
pnpm test
```

Build toàn repo:

```powershell
pnpm build
```

Chạy test cho từng package:

```powershell
pnpm --filter @agentops/api test
pnpm --filter @agentops/web test
pnpm --filter @agentops/events test
pnpm --filter @agentops/config test
pnpm --filter @agentops/workflow-worker test
pnpm --filter @agentops/ai-worker test
pnpm --filter @agentops/tool-worker test
pnpm --filter @agentops/notification-worker test
```

Chạy Playwright e2e cho frontend:

```powershell
pnpm --filter @agentops/web test:e2e
```

Nếu Playwright chưa có browser binary:

```powershell
pnpm exec playwright install
```

## 8. Smoke test cases

### TC-01: Docker services chạy đủ

Command:

```powershell
docker compose ps
```

Expected:

```txt
postgres, redis, kafka healthy
prometheus, grafana, alertmanager, tempo up
```

### TC-02: API live

Command:

```powershell
Invoke-RestMethod http://localhost:4000/health/live
```

Expected:

```json
{
  "status": "ok"
}
```

### TC-03: API ready với PostgreSQL, Redis, Kafka

Command:

```powershell
Invoke-RestMethod http://localhost:4000/health/ready
```

Expected:

```json
{
  "status": "ok",
  "details": {
    "postgres": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    },
    "kafka": {
      "status": "up"
    }
  }
}
```

### TC-04: Frontend load được

Command:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3000).StatusCode
```

Expected:

```txt
200
```

### TC-05: Register user mock

Command:

```powershell
$body = @{
  email = "demo+local@agentops.local"
  password = "password123"
  name = "Local Demo"
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/auth/register `
  -ContentType "application/json" `
  -Body $body

$session
```

Expected:

```txt
response có user, accessToken, refreshToken
```

### TC-06: Lấy current user từ token

Command:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:4000/auth/me `
  -Headers @{ Authorization = "Bearer $($session.accessToken)" }
```

Expected:

```txt
email = demo+local@agentops.local
name = Local Demo
```

### TC-07: List workflows

Command:

```powershell
Invoke-RestMethod http://localhost:4000/workflows
```

Expected:

```txt
có workflow demo wf_lead_qualification
```

### TC-08: Publish workflow demo

Command:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/workflows/wf_lead_qualification/publish `
  -Headers @{ "x-workspace-role" = "ADMIN" }
```

Expected:

```txt
workflow.status = ACTIVE
version.versionNumber >= 1
```

### TC-09: Run workflow demo

Command:

```powershell
$runBody = @{
  triggerType = "manual"
  input = @{
    lead = @{
      name = "Nguyen Van A"
      email = "a@example.com"
      company = "Acme"
      message = "Can tu van giai phap AI workflow"
    }
  }
} | ConvertTo-Json -Depth 8

$runResult = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/workflows/wf_lead_qualification/run `
  -Headers @{ "x-workspace-role" = "MEMBER" } `
  -ContentType "application/json" `
  -Body $runBody

$runResult
```

Expected:

```txt
run.status = PENDING
event.type = workflow-triggered
event.workflowRunId = run.id
```

### TC-10: Xem run steps

Command:

```powershell
Invoke-RestMethod "http://localhost:4000/workflow-runs/$($runResult.run.id)/steps"
```

Expected:

```txt
steps có danh sách node của workflow
node đầu tiên COMPLETED hoặc workflow trigger accepted
```

### TC-11: Test AI agent mock

Command:

```powershell
$aiBody = @{
  modelProvider = "mock"
  input = @{
    lead = "Founder dang tim automation cho CRM"
  }
  config = @{
    task = "score-lead"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/ai/test-agent `
  -ContentType "application/json" `
  -Body $aiBody
```

Expected:

```txt
response có output mock/structured result
```

### TC-12: Metrics endpoints

Command:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:4000/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4101/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4102/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4103/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4104/metrics).StatusCode
```

Expected:

```txt
tất cả trả 200
```

### TC-13: Grafana và Prometheus

Command:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3001).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:9090).StatusCode
```

Expected:

```txt
tất cả trả 200
```

## 9. Stop hệ thống

Stop dev process bằng `Ctrl+C` trong terminal đang chạy `turbo`.

Stop Docker containers nhưng giữ data volumes:

```powershell
pnpm compose:down
```

Xóa cả containers và local volumes của AgentOps:

```powershell
docker compose down -v
```

Chỉ dùng `down -v` khi muốn reset sạch PostgreSQL, Kafka, Redis, Grafana, Prometheus local data.

## 10. Troubleshooting nhanh

Nếu cần chạy Turbo trực tiếp, dùng:

```powershell
pnpm exec turbo run dev --concurrency=13
```

Nếu Next.js báo `EADDRINUSE: address already in use :::3000`, nghĩa là frontend đang chạy sẵn trên port `3000`. Kiểm tra process giữ port:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 3000 } |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Nếu đó là terminal dev cũ, stop terminal đó bằng `Ctrl+C`. Nếu là process nền bị kẹt trong repo này, dừng các Node dev process của AgentOps:

```powershell
$procs = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -like "*AgentOps*Workflow*Automation*Platform*"
  }

$procs | Select-Object ProcessId,Name,CommandLine
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Nếu API readiness báo Kafka down:

```powershell
docker compose ps kafka
pnpm kafka:bootstrap
```

Nếu database lỗi connection:

```powershell
docker compose ps postgres
pnpm db:push
```

Nếu port bị chiếm:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,4000,4101,4102,4103,4104 }
```

Nếu muốn xem log Docker:

```powershell
docker compose logs -f postgres redis kafka
docker compose logs -f prometheus grafana tempo alertmanager
```

Nếu muốn xem log dev app khi chạy bằng terminal, đọc trực tiếp terminal đang chạy `turbo`.
