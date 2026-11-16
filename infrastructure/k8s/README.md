# Kubernetes

Kubernetes manifests are organized with kustomize: a shared `base/`, reusable `components/`, one-off `jobs/`, and environment `overlays/`.

```txt
k8s/
  base/                  # namespace, config, apps, ingress, network policies, HPA, ExternalSecret
  components/
    in-cluster-data/     # Postgres, Redis, Kafka for dev/k3s
  jobs/
    db-migrate/          # one-shot migration Job
  overlays/
    dev/
    prod/
    aws/                 # pointer to prod + AWS prerequisites
```

## Base

`base/` contains:

- namespace `agentops`
- ConfigMap `agentops-config` (no secrets)
- one ServiceAccount per workload, with the service account token not mounted
- Deployments + Services: `agentops-api` (4000), `agentops-web` (3000), `workflow-worker`, `ai-worker`, `tool-worker`, `notification-worker` (metrics 9100)
- probes (api startup, readiness `/health/ready`, liveness), requests/limits
- pod security: `runAsNonRoot`, `readOnlyRootFilesystem`, drop ALL capabilities, `seccompProfile: RuntimeDefault`, `/tmp` emptyDir
- HPA on CPU (api 1-3; workers 1-3, since each topic has 3 partitions)
- Ingress (nginx + cert-manager TLS); the API host exposes only the public route groups, never `/metrics`
- NetworkPolicies: default-deny ingress; ingress-nginx -> web/api; web -> api; monitoring -> metrics; egress open for OpenAI and AWS managed services
- ExternalSecret `agentops-secrets` (keys `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`, `POSTGRES_PASSWORD`) from ClusterSecretStore `agentops-secrets-store`

`base/secrets.example.env` lists those keys for a manual `kubectl create secret` on a local k3s.

## Components

`components/in-cluster-data/` adds Postgres, Redis, and Kafka for dev/k3s, with readiness probes, resources, and NetworkPolicies. Production overlays use managed AWS data services instead.

## Jobs

`jobs/db-migrate/` is a one-shot Job run once per release, before rolling out. Jobs are immutable: delete the previous Job before re-applying.

## Overlays

| Overlay | Images | TLS | Secrets | Data | Notes |
| --- | --- | --- | --- | --- | --- |
| `dev` | ECR `dev/<app>` | letsencrypt-staging | AWS Secrets Manager `agentops/dev/app` | in-cluster | HPA max 2, `APP_ENV=dev` |
| `prod` | ECR `prod/<app>` pinned per release | letsencrypt-prod | `agentops/prod/app` | managed MSK/ElastiCache (placeholders from Terraform outputs) | api/web 2 replicas spread across zones + PDB `minAvailable: 1`, HPA api 2-6, workers 2-3 |

`overlays/aws/` only points at `overlays/prod` and documents the AWS prerequisites.

## Monitoring

`monitoring/` deploys Prometheus, Alertmanager, Grafana and Tempo into the `monitoring` namespace, reusing the rules and dashboards from `infrastructure/observability`. Prometheus discovers the `agentops` pods and labels them with the same `service` names as the local stack. It needs two Secrets first (`alertmanager-webhook` with key `token`, `grafana-admin` with keys `user` and `password`) and is rendered with a relaxed load restrictor because it reads files outside its directory:

```bash
kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/k8s/monitoring | kubectl apply --server-side -f -
```

Storage is `emptyDir`; nothing is exposed outside the cluster (use `kubectl port-forward`).

## Validation

`pnpm k8s:validate` renders with kustomize v5.6.0 and checks with kubeconform v0.6.7 (`-strict`, Kubernetes 1.31 + datreeio CRD catalog): dev 47 resources, prod 37, job 1, 0 invalid.

## Deploy Order

1. Install ingress-nginx, cert-manager, and External Secrets.
2. Create the secret in AWS Secrets Manager.
3. `kubectl apply -k infrastructure/k8s/jobs/db-migrate` with the overlay's image.
4. `kubectl apply -k infrastructure/k8s/overlays/<env>`.
