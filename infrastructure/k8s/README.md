# Kubernetes

Kubernetes manifests are organized as base resources plus environment overlays.

```txt
k8s/
  base/
  overlays/
    dev/
    aws/
    prod/
```

## Required Workloads

- frontend
- api-backend
- workflow-worker
- ai-worker
- tool-worker
- notification-worker
- postgres
- redis
- kafka

Each application workload should include liveness and readiness probes.

The base folder includes demo-grade PostgreSQL, Redis, and Kafka manifests for EC2+k3s. For EKS production, prefer managed AWS data services and override `DATABASE_URL`, `REDIS_URL`, and `KAFKA_BROKERS`.
