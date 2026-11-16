# Prod Overlay

The prod overlay is the portfolio-ready deployment shape. It expects
**managed AWS services** instead of the in-cluster data component:

- Amazon RDS / Aurora PostgreSQL (via `DATABASE_URL`, kept in the secret).
- Amazon ElastiCache for Redis (`REDIS_URL`).
- Amazon MSK (`KAFKA_BROKERS`).

Both endpoints are `REPLACE_WITH_*` placeholders filled from Terraform
outputs. Secrets come from AWS Secrets Manager (`agentops/prod/app`), and
TLS uses the `letsencrypt-prod` ClusterIssuer.

It adds: 2 replicas for `agentops-api`/`agentops-web` with zone topology
spread, an API HPA (2-6 replicas), KEDA lag-based autoscaling for the four workers (1-6 replicas, `components/keda-autoscaling`, 6 topic partitions), and PodDisruptionBudgets.

Apply the DB migration Job **first**, then the overlay:

```bash
kubectl apply -k infrastructure/k8s/jobs/db-migrate
kubectl apply -k infrastructure/k8s/overlays/prod
```
