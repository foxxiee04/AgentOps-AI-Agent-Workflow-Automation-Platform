# Kubernetes

Kubernetes manifests are organized as base resources plus environment overlays.

```txt
k8s/
  base/
  overlays/
    dev/
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

