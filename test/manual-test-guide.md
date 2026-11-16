# AgentOps Manual Test Guide

Huong dan nay dung de test thu cong toan bo he thong AgentOps tren Docker local.

## 1. Dieu kien truoc khi chay

- Docker Desktop dang chay.
- Node.js 22 va pnpm 11.x da cai.
- Dang o thu muc goc repo.

```powershell
pnpm install
pnpm local:docker
```

Neu muon reset sach database, Kafka, Redis va cac volume local cua AgentOps:

```powershell
pnpm compose:apps:reset
```

Lenh reset nay se xoa volume Docker local cua project AgentOps, tao lai DB, push Prisma schema, seed demo data va bootstrap Kafka topics.

## 2. URL can kiem tra

| Thanh phan | URL |
| --- | --- |
| Web app | http://localhost:3000 |
| Landing English | http://localhost:3000/en |
| Landing Vietnamese | http://localhost:3000/vi |
| API ready health | http://localhost:4000/health/ready |
| API live health | http://localhost:4000/health/live |
| API metrics | http://localhost:4000/metrics |
| Workflow worker health | http://localhost:4101/health/live |
| AI worker health | http://localhost:4102/health/live |
| Tool worker health | http://localhost:4103/health/live |
| Notification worker health | http://localhost:4104/health/live |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

Grafana local: user `agentops`, password `agentops`.

## 3. Demo data co san

Sau khi chay `pnpm local:docker` hoac `pnpm compose:apps:reset`, database co san:

| Du lieu | Gia tri |
| --- | --- |
| Demo user | `demo@agentops.local` |
| Workspace | `ws_demo` |
| Workflow | `wf_lead_qualification` |
| Workflow version | `wfv_seed_lead_qualification_v1` |
| Seed run | `run_seed_lead_qualification` |

So luong du lieu sau reset sach nen la:

| Bang | So luong |
| --- | ---: |
| users | 1 |
| workspaces | 1 |
| workflows | 1 |
| workflow_versions | 1 |
| workflow_runs | 1 |
| workflow_steps | 5 |
| domain_events | 1 |
| usage_records | 1 |

De dang nhap UI trong moi truong local, dung bat ky email co duoi `@agentops.local`, vi auth local MVP chap nhan mat khau demo:

```txt
Email: operator@agentops.local
Password: password123
```

## 4. Test nhanh bang Docker

Kiem tra container:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Tat ca container chinh nen dang `Up`, rieng web, API, Postgres, Redis, Kafka nen co trang thai `healthy`.

Kiem tra API ready:

```powershell
Invoke-RestMethod http://localhost:4000/health/ready
```

Ket qua mong doi: `status` la `ok`, cac dependency `postgres`, `redis`, `kafka` deu `up`.

Kiem tra frontend:

```powershell
Invoke-WebRequest http://localhost:3000/en
Invoke-WebRequest http://localhost:3000/vi
```

Ket qua mong doi: HTTP 200.

## 5. Test thu cong tren browser

1. Mo http://localhost:3000/en.
2. Kiem tra landing page English: sang, chu de doc, layout khong lech, CTA vao product ro rang.
3. Mo http://localhost:3000/vi.
4. Kiem tra landing page Vietnamese: noi dung tieng Viet, khong bi tran chu tren desktop/mobile.
5. Vao login va dang nhap bang `operator@agentops.local` / `password123`.
6. Kiem tra dashboard hien thi overview, recent activity, workflow/run metrics.
7. Vao Workflows, kiem tra workflow `Lead Qualification Agent` co san.
8. Bam publish workflow neu co nut publish.
9. Bam run/manual trigger workflow.
10. Vao Runs, mo run moi nhat, kiem tra cac step co trang thai va log.
11. Vao workflow builder, kiem tra node trigger, AI score lead, condition, webhook/email/task/end hien thi dung.
12. Vao Agents, test agent voi JSON input mau neu UI co form test.
13. Vao Settings, kiem tra trang khong loi va thong tin workspace hien thi on dinh.

## 6. Test API smoke

Dang ky user local va lay token:

```powershell
$email = "manual-smoke+$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@agentops.local"
$auth = Invoke-RestMethod -Method Post http://localhost:4000/auth/register `
  -ContentType "application/json" `
  -Body (@{ email=$email; password="password123"; name="Manual Smoke" } | ConvertTo-Json)
$token = $auth.accessToken
$headers = @{ Authorization = "Bearer $token" }
```

Kiem tra auth:

```powershell
Invoke-RestMethod http://localhost:4000/auth/me -Headers $headers
```

Kiem tra workflow list:

```powershell
Invoke-RestMethod "http://localhost:4000/workflows?workspaceId=ws_demo" -Headers $headers
```

Publish va run workflow demo:

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/workflows/wf_lead_qualification/publish -Headers $headers

$run = Invoke-RestMethod -Method Post http://localhost:4000/workflows/wf_lead_qualification/run `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ input=@{ name="Anna Nguyen"; company="Shop ABC"; email="anna@shopabc.vn"; message="Chung toi can tu dong hoa tra loi khach hang qua chat va theo doi don hang."; source="website_form" } } | ConvertTo-Json -Depth 5)

$run
```

Kiem tra step cua run:

```powershell
Invoke-RestMethod "http://localhost:4000/workflow-runs/$($run.run.id)/steps" -Headers $headers
```

Kiem tra AI test endpoint:

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/ai/test-agent `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ prompt="Score this lead"; input=@{ company="Acme"; role="VP Sales"; intent="high" } } | ConvertTo-Json -Depth 5)
```

Kiem tra bo lead mau co nhan (24 lead, nen chay lai sau moi lan doi prompt):

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/ai/evaluate-agent -Headers $headers `
  -ContentType "application/json" -Body "{}" | Select-Object totalCases, passed, passRate
```

Lead nong (leadScore > 80) di nhanh email -> approval (tu duyet o seed) -> email mock -> task goi lai; lead <= 80 ket thuc ngay sau buoc cham diem. Dat `AI_DAILY_CALL_LIMIT=1` de thu HTTP 429.

Kiem tra usage:

```powershell
Invoke-RestMethod http://localhost:4000/ai/usage -Headers $headers
```

## 7. Reset va seed lai database

Full Docker reset, nen dung khi muon bat dau lai tu dau:

```powershell
pnpm compose:apps:reset
```

Chi seed lai tren stack dang chay, khong xoa data cu:

```powershell
docker compose -f docker-compose.yml -f docker-compose.apps.yml run --rm setup
```

Neu chi chay ha tang Docker va API/web tren may host:

```powershell
pnpm compose:up
pnpm db:reset
pnpm kafka:bootstrap
```

`pnpm db:reset` xoa va tao lai schema tu cac migration co version, roi chay seed bat buoc va seed demo. Lenh chi chay khi DATABASE_URL tro toi host local va APP_ENV=local; moi truong khac se bi tu choi.

## 8. Lenh test tu dong nen pass

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Neu Turbo replay log loi cu ve Prisma generated files nhung command van exit code 0, chay lai:

```powershell
pnpm --filter @agentops/database db:generate
pnpm --filter @agentops/database build
```

## 9. Dung stack

Khi test xong:

```powershell
pnpm compose:apps:down
```

Neu can xem log:

```powershell
pnpm compose:apps:logs
```
