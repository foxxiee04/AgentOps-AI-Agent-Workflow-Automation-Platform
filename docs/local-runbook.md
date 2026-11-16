# Local Runbook

File này là bản chạy local ngắn gọn cho AgentOps. Dùng PowerShell tại thư mục gốc repo:

```powershell
cd "E:\AgentOps — AI Agent Workflow Automation Platform"
```

## 1. Chạy lần đầu

Kiểm tra toolchain:

```powershell
node --version
pnpm --version
docker --version
```

Yêu cầu khuyến nghị:

| Tool    | Version                           |
| ------- | --------------------------------- |
| Node.js | `>=22.0.0`                        |
| pnpm    | `>=11.0.0`                        |
| Docker  | Docker Desktop hoặc Docker Engine |

Cài dependency và tạo env local:

```powershell
pnpm install
Copy-Item .env.example .env
```

Nếu file `.env` đã tồn tại thì bỏ qua lệnh `Copy-Item`.

## 2. Start Docker Desktop trước

Trước khi chạy bất kỳ lệnh Docker nào, mở Docker Desktop và đợi trạng thái `Running`.

Kiểm tra Docker daemon:

```powershell
docker info
```

Nếu gặp lỗi kiểu này:

```txt
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

thì Docker Desktop chưa chạy, Linux engine chưa sẵn sàng, hoặc Docker Desktop đang lỗi. Cách xử lý nhanh:

```powershell
# 1. Mở Docker Desktop bằng Start Menu
# 2. Đợi Docker báo Running
docker info
```

Lỗi `unable to get image 'grafana/grafana:12.2.0'` kèm pipe `dockerDesktopLinuxEngine` không phải lỗi Grafana. Đây là lỗi Docker daemon chưa chạy.

## 3. Start hạ tầng local

Chạy PostgreSQL, Redis, Kafka, Prometheus, Grafana, Alertmanager, Tempo và chuẩn bị database/Kafka topics:

```powershell
pnpm local:up
```

Lệnh trên tương đương:

```powershell
pnpm compose:up
pnpm local:setup
```

Kiểm tra container:

```powershell
docker compose ps
```

Nếu chỉ muốn bật hạ tầng bắt buộc cho app:

```powershell
docker compose up -d postgres redis kafka
pnpm local:setup
```

## 4. Start hệ thống

Chạy toàn bộ app ở chế độ dev:

```powershell
pnpm dev
```

Lệnh này chạy frontend, backend, workers và các package shared ở watch mode.

URL chính:

| Mục         | URL                                  |
| ----------- | ------------------------------------ |
| Web app     | `http://localhost:3000`              |
| API Swagger | `http://localhost:4000/docs`         |
| API live    | `http://localhost:4000/health/live`  |
| API ready   | `http://localhost:4000/health/ready` |
| Grafana     | `http://localhost:3001`              |
| Prometheus  | `http://localhost:9090`              |

## 5. Start từng phần

Mỗi lệnh dưới đây chạy ở một terminal riêng. Trước đó cần chạy `pnpm local:up` ít nhất một lần.

Backend:

```powershell
pnpm dev:api
```

Frontend:

```powershell
pnpm dev:web
```

Workers:

```powershell
pnpm dev:workers
```

Nếu cần chạy worker riêng:

```powershell
pnpm --filter @agentops/workflow-worker dev
pnpm --filter @agentops/ai-worker dev
pnpm --filter @agentops/tool-worker dev
pnpm --filter @agentops/notification-worker dev
```

## 6. Test commands

Kiểm tra type:

```powershell
pnpm typecheck
```

Chạy toàn bộ unit tests:

```powershell
pnpm test
```

Chạy test theo nhóm:

```powershell
pnpm test:api
pnpm test:web
pnpm test:workers
```

Chạy Playwright e2e cho frontend:

```powershell
pnpm test:e2e
```

Nếu Playwright chưa có browser binary:

```powershell
pnpm exec playwright install
```

## 7. Smoke test nhanh

### TC-01: Docker chạy được

```powershell
docker info
docker compose ps
```

Expected: không còn lỗi pipe `dockerDesktopLinuxEngine`; `postgres`, `redis`, `kafka` healthy hoặc running.

### TC-02: API live

```powershell
Invoke-RestMethod http://localhost:4000/health/live
```

Expected:

```json
{
  "status": "ok"
}
```

### TC-03: API ready

```powershell
Invoke-RestMethod http://localhost:4000/health/ready
```

Expected: `postgres`, `redis`, `kafka` đều `up`.

### TC-04: Frontend load được

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3000).StatusCode
```

Expected:

```txt
200
```

### TC-05: Register user local

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

Expected: response có `user`, `accessToken`, `refreshToken`.

### TC-06: Lấy current user

```powershell
Invoke-RestMethod `
  -Uri http://localhost:4000/auth/me `
  -Headers @{ Authorization = "Bearer $($session.accessToken)" }
```

Expected: email là `demo+local@agentops.local`.

### TC-07: List workflows

```powershell
Invoke-RestMethod http://localhost:4000/workflows
```

Expected: có workflow demo `wf_lead_qualification`.

### TC-08: Publish và run workflow demo

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/auth/login -ContentType "application/json" -Body (@{ email = "demo@agentops.local"; password = "<your-local-password>" } | ConvertTo-Json)
$token = $login.accessToken

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:4000/workflows/wf_lead_qualification/publish `
  -Headers @{ Authorization = "Bearer $token" }

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
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $runBody

$runResult
```

Expected: `run.status = PENDING` và event type là `workflow-triggered`. Roles come from workspace membership, not from a header; a VIEWER gets 403.

### TC-09: Metrics

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:4000/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4101/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4102/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4103/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4104/metrics).StatusCode
```

Expected: tất cả trả `200` khi backend và workers đang chạy.

## 8. Stop hệ thống

Stop dev process bằng `Ctrl+C` trong terminal đang chạy `pnpm dev`, `pnpm dev:api`, `pnpm dev:web`, hoặc `pnpm dev:workers`.

Stop Docker containers nhưng giữ data volumes:

```powershell
pnpm compose:down
```

Reset sạch local data:

```powershell
docker compose down -v
```

Chỉ dùng `down -v` khi muốn xóa PostgreSQL, Kafka, Redis, Grafana, Prometheus local data.

## 9. Troubleshooting nhanh

Kiểm tra port app đang bị chiếm:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3000,4000,4101,4102,4103,4104 }
```

Nếu port đã có process cũ, stop terminal dev cũ bằng `Ctrl+C`.

Nếu API readiness báo Kafka down:

```powershell
docker compose ps kafka
pnpm kafka:bootstrap
```

Nếu database lỗi connection:

```powershell
docker compose ps postgres
pnpm db:migrate:status
pnpm db:migrate:deploy
```

Xem log Docker:

```powershell
docker compose logs -f postgres redis kafka
docker compose logs -f prometheus grafana tempo alertmanager
```
