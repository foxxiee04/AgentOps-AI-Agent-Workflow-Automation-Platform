# Production verification - 2026-11-18T14:56:24.800Z

Host: `agentops.18-136-215-126.sslip.io` - 27/27 checks passed.


## Endpoints

| Check | Result | Detail |
| --- | --- | --- |
| web landing | PASS | HTTP 200 in 493 ms (expected 200) |
| API readiness (postgres, redis, kafka) | PASS | HTTP 200 in 186 ms (expected 200) |
| API liveness | PASS | HTTP 200 in 174 ms (expected 200) |
| protected route without session | PASS | HTTP 401 in 69 ms (expected 401) |
| admin route without session | PASS | HTTP 401 in 55 ms (expected 401) |
| metrics are not public | PASS | HTTP 404 in 53 ms (expected 404) |

## TLS

| Check | Result | Detail |
| --- | --- | --- |
| certificate for agentops.18-136-215-126.sslip.io | PASS | Let's Encrypt, 89 days left |
| certificate for api.agentops.18-136-215-126.sslip.io | PASS | Let's Encrypt, 89 days left |

## Workloads

| Check | Result | Detail |
| --- | --- | --- |
| agentops-api | PASS | 2/2 ready, api:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| agentops-web | PASS | 2/2 ready, web:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| ai-worker | PASS | 1/1 ready, ai-worker:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| notification-worker | PASS | 1/1 ready, notification-worker:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| tool-worker | PASS | 1/1 ready, tool-worker:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| workflow-worker | PASS | 1/1 ready, workflow-worker:ab7599317ec538ecf59cc8c85603f6ef3bd033c1 |
| running pods and restarts | PASS | 8 running pods, 0 restarts in total |

## Autoscaling

| Check | Result | Detail |
| --- | --- | --- |
| horizontal pod autoscalers | PASS | agentops-api 2/6, keda-hpa-ai-worker 1/6, keda-hpa-notification-worker 1/6, keda-hpa-tool-worker 1/6, keda-hpa-workflow-worker 1/6 |
| KEDA scaled objects (Kafka lag) | PASS | ai-worker: True, notification-worker: True, tool-worker: True, workflow-worker: True |

## Prometheus

| Check | Result | Detail |
| --- | --- | --- |
| scrape targets up | PASS | agentops-api 2/2, agentops-workers 4/4, prometheus 1/1 |
| alert rules loaded | PASS | 5 groups, 17 rules |
| no warning/critical alert firing | PASS | none |
| API requests served (5m) | PASS | sum(increase(agentops_http_requests_total[5m])) = 101 |
| worker messages consumed since start | PASS | sum(agentops_worker_messages_consumed_total) = 3 |
| Kafka consumer lag (all groups) | PASS | sum(agentops_kafka_consumer_lag) = 0 |
| users known to the platform | PASS | max(agentops_users_total) = 2 |

## Alerting

| Check | Result | Detail |
| --- | --- | --- |
| Alertmanager delivers to the API webhook | PASS | firing notifications 1 -> 2 |

## Tracing

| Check | Result | Detail |
| --- | --- | --- |
| services exporting traces (24 h) | PASS | agentops-ai-worker, agentops-api, agentops-workflow-worker |
| one lead run traced across services | PASS | 383c7f9f909c4f4c: 9 spans over agentops-api, agentops-workflow-worker, agentops-ai-worker |
