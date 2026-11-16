# Dev Overlay

The dev overlay is the low-cost, self-contained environment. It keeps
single-replica data services and caps every HPA at `maxReplicas: 2`.

What it contains:

- Everything from `../../base` plus the `in-cluster-data` component
  (demo-grade PostgreSQL, Redis, and Kafka).
- `ClusterSecretStore` backed by AWS Secrets Manager in `ap-southeast-1`.
- A Let's Encrypt **staging** `ClusterIssuer` (`letsencrypt-staging`).
- Dev hosts `dev.agentops.example.com` / `api.dev.agentops.example.com`.
- Dev config (`APP_ENV=dev`) and secrets at `agentops/dev/app`.
- ECR images under the `dev/` repositories (placeholder account id; the
  pipeline sets the tag with `kustomize edit set image`).

Apply it with:

```bash
kubectl apply -k infrastructure/k8s/overlays/dev
```
