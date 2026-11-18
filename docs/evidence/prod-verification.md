# Production verification - 2026-11-17T18:46:19.000Z

Host: `agentops.18-136-215-126.sslip.io` - 27/27 checks passed.


## Endpoints

| Check | Result | Detail |
| --- | --- | --- |
| web landing | PASS | HTTP 200 in 265 ms (expected 200) |
| API readiness (postgres, redis, kafka) | PASS | HTTP 200 in 622 ms (expected 200) |
| API liveness | PASS | HTTP 200 in 159 ms (expected 200) |
| protected route without session | PASS | HTTP 401 in 56 ms (expected 401) |
| admin route without session | PASS | HTTP 401 in 56 ms (expected 401) |
| metrics are not public | PASS | HTTP 404 in 50 ms (expected 404) |

## TLS

| Check | Result | Detail |
| --- | --- | --- |
| certificate for agentops.18-136-215-126.sslip.io | PASS | Let's Encrypt, 90 days left |
| certificate for api.agentops.18-136-215-126.sslip.io | PASS | Let's Encrypt, 90 days left |

## Workloads

| Check | Result | Detail |
| --- | --- | --- |
| agentops-api | PASS | 2/2 ready, api:cab6f649ac36092e5caac92c38eedcdcf2753350 |
| agentops-web | PASS | 2/2 ready, web:cab6f649ac36092e5caac92c38eedcdcf2753350 |
| ai-worker | PASS | 1/1 ready, ai-worker:cab6f649ac36092e5caac92c38eedcdcf2753350 |
| notification-worker | PASS | 1/1 ready, notification-worker:cab6f649ac36092e5caac92c38eedcdcf2753350 |
| tool-worker | PASS | 1/1 ready, tool-worker:cab6f649ac36092e5caac92c38eedcdcf2753350 |
| workflow-worker | PASS | 1/1 ready, workflow-worker:cab6f649ac36092e5caac92c38eedcdcf2753350 |
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
| API requests served (5m) | PASS | sum(increase(agentops_http_requests_total[5m])) = 102 |
| worker messages consumed since start | PASS | sum(agentops_worker_messages_consumed_total) = 0 |
| Kafka consumer lag (all groups) | PASS | sum(agentops_kafka_consumer_lag) = 0 |
| users known to the platform | PASS | max(agentops_users_total) = 2 |

## Alerting

| Check | Result | Detail |
| --- | --- | --- |
| Alertmanager delivers to the API webhook | PASS | firing notifications 0 -> 1 |

## Tracing

| Check | Result | Detail |
| --- | --- | --- |
| services exporting traces (24 h) | PASS | agentops-ai-worker, agentops-api, agentops-notification-worker, agentops-tool-worker, agentops-workflow-worker |
| one lead run traced across services | PASS | 2a34ecb7bb6a1daa: 9 spans over agentops-workflow-worker, agentops-api, agentops-ai-worker |
