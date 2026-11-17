# Production Runbook (AWS EKS)

How the production environment is brought up, what had to be fixed on the way, and how to tear it down. The environment is created as a **short-lived** stack (`ephemeral = true`): built for a few hours, then destroyed.

## History

- **2026-11-16/17 — first bring-up.** The stack was created, the problems below were fixed, and the showcase seed ran.
- **2026-11-17 — teardown.** The stack was destroyed to stop costs. A manual RDS snapshot `agentops-prod-before-teardown-20261117` was kept.
- **2026-11-17 — second bring-up.** The stack was brought up again the same day with the current code: `terraform apply` (54 resources, about 35 minutes; MSK is the slowest), the EKS access entry for the admin principal, the add-ons (metrics-server, ingress-nginx NLB, cert-manager, external-secrets, KEDA), the app secret, the base manifests, and then the GitHub Actions **Deploy prod** workflow, which builds the 7 images and deploys them.

Each bring-up creates a new Network Load Balancer, so the public host changes every time (sslip.io embeds the load balancer IP in the name). See "After a new bring-up" for the variables and OAuth URIs to update.

## What is running

| Item | Value |
| --- | --- |
| Region | `ap-southeast-1` |
| Cluster | EKS `agentops-prod`, Kubernetes 1.31, 2 x `t3.medium` in private subnets |
| Data | RDS PostgreSQL `db.t4g.micro`, ElastiCache Redis `cache.t4g.micro` (TLS), MSK Kafka 3.9.x with 2 x `kafka.t3.small` |
| Web | `https://agentops.<lb-ip-dashed>.sslip.io` |
| API | `https://api.agentops.<lb-ip-dashed>.sslip.io` |
| TLS | cert-manager with Let's Encrypt (HTTP-01) |
| Images | ECR `prod/<app>`: `r1` for api, tools and workers, `r2` for web |
| Cost | About USD 0.5 per hour while it runs |

There is no registered domain. The hosts use [sslip.io](https://sslip.io), which resolves `anything.1-2-3-4.sslip.io` to `1.2.3.4`; the IP is one of the two static addresses of the Network Load Balancer. With a real domain, replace the hosts in the overlay and point DNS at the load balancer.

## Bring-up

Prerequisites: AWS CLI logged in, Terraform, kubectl, Docker.

1. **Terraform.** In `infrastructure/terraform/environments/prod` create `terraform.tfvars` (owner, GitHub repository, `ephemeral = true`, `eks_public_access_cidrs = ["0.0.0.0/0"]`) and, for a short-lived stack, a `backend_override.tf` with a local backend. Both files are gitignored. The public endpoint is open because GitHub-hosted runners deploy to it; authentication still goes through IAM and EKS access entries.

   ```bash
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

   The apply creates 54 resources in about 35 minutes; MSK is the slowest part.

2. **Cluster access.**

   ```bash
   aws eks update-kubeconfig --name agentops-prod --region ap-southeast-1
   ```

   An account root user gets no access entry automatically; create one and attach `AmazonEKSClusterAdminPolicy` (see "Problems found").

3. **Add-ons**: metrics-server, ingress-nginx (NLB), cert-manager, External Secrets (service account annotated with the `external_secrets_role_arn` output) and KEDA, from their Helm charts.

4. **Images.** Build with the repository scripts and push to ECR. The web image needs the public API URL at build time:

   ```bash
   docker build -f infrastructure/docker/web.Dockerfile \
     --build-arg NEXT_PUBLIC_API_URL=https://api.<host> -t <registry>/prod/web:<tag> .
   ```

5. **Application secret.** Put a JSON value into `agentops/prod/app` with `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALERTMANAGER_WEBHOOK_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Build `DATABASE_URL` from the `rds_endpoint` output and the RDS-managed secret, and end it with `?sslmode=require&uselibpqcompat=true` (RDS requires TLS; the flag keeps the Node driver from demanding a CA bundle). External Secrets syncs this secret into the cluster; it never enters Git or Terraform state.

6. **Overlay values.** Copy `infrastructure/k8s` to a working directory and replace the placeholders in `overlays/prod`: the account id, the image tags, `REPLACE_WITH_MSK_BOOTSTRAP_BROKERS:9092` (output `kafka_bootstrap_brokers`), `REPLACE_WITH_ELASTICACHE_ENDPOINT` (output `redis_url`, scheme `rediss://`) and the `agentops.example.com` hosts. Add `KAFKA_TOPIC_REPLICATION_FACTOR: "2"` and `AUTH_COOKIE_DOMAIN: <web host>`. Set `GOOGLE_OAUTH_REDIRECT_URI` in the ConfigMap to `https://api.<web host>/auth/google/callback`. The prod overlay also sets `DEMO_WORKSPACE_JOIN_ROLE: VIEWER`.

7. **Migrate, then deploy.**

   ```bash
   kubectl apply -k jobs/db-migrate
   kubectl -n agentops wait --for=condition=complete job/agentops-db-migrate --timeout=300s
   kubectl apply -k overlays/prod
   ```

   The GitHub Actions **Deploy prod** workflow builds the 7 images and deploys them (migration Job first, then the Deployments). Set the repository variable `PROD_DEPLOY_ENABLED=true` to enable the deploy job, and set `PROD_WEB_HOST` / `PROD_API_URL` to the current hosts (see "After a new bring-up"). The workflow reaches the cluster through the open EKS public endpoint with an IAM role from GitHub OIDC.

8. **Monitoring.**

   ```bash
   kubectl create namespace monitoring
   kubectl -n monitoring create secret generic alertmanager-webhook --from-literal=token=<ALERTMANAGER_WEBHOOK_TOKEN>
   kubectl -n monitoring create secret generic grafana-admin --from-literal=user=admin --from-literal=password=<password>
   kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/k8s/monitoring | kubectl apply --server-side -f -
   ```

   Verify the scrape targets and the rules: Prometheus `/targets` shows 7 targets (2 API pods, 4 workers and Prometheus itself) and `/alerts` lists 17 alert rules in 5 groups. Then send an end-to-end test alert:

   ```bash
   kubectl -n monitoring exec deploy/alertmanager -- wget -qO- \
     --header='Content-Type: application/json' \
     --post-data '[{"labels":{"alertname":"AgentOpsTestAlert","severity":"info","service":"api"}}]' \
     http://localhost:9093/api/v2/alerts
   ```

   Alertmanager posts it to the API webhook `POST /notifications/alertmanager`, which returns `201` and increments `agentops_alertmanager_notifications_total` on both API pods. `AgentOpsAlertBotInactive` (info) is expected to stay pending on a fresh stack until the first alert arrives.

9. **Smoke test.**

   ```bash
   curl https://api.<host>/health/ready
   ```

## After a new bring-up

The web host changes with every new Network Load Balancer, because sslip.io hosts embed the load balancer IP. Update all of these before deploying or sharing the environment:

- GitHub repository variables `PROD_WEB_HOST` (e.g. `agentops.<lb-ip-dashed>.sslip.io`) and `PROD_API_URL` (e.g. `https://api.agentops.<lb-ip-dashed>.sslip.io`).
- The Google OAuth client in Google Cloud Console: the authorized redirect URI `https://api.<web host>/auth/google/callback` and the JavaScript origin of the web host.
- The prod overlay: `AUTH_COOKIE_DOMAIN` and the ingress hosts, plus `GOOGLE_OAUTH_REDIRECT_URI` in the ConfigMap.

## Access

Grafana, Prometheus and Alertmanager are not exposed to the internet. Use a port-forward:

```bash
kubectl -n monitoring port-forward svc/grafana 3002:3000
kubectl -n monitoring port-forward svc/prometheus 9091:9090
```

Credentials created during the bring-up are stored only as Kubernetes Secrets:

```bash
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.password}' | base64 -d
kubectl -n agentops get secret agentops-showcase-user -o jsonpath='{.data.email}' | base64 -d
kubectl -n agentops get secret agentops-showcase-user -o jsonpath='{.data.password}' | base64 -d
```

The showcase user is an OWNER of the demo workspace and is the account to log in with on the production web app (demo login is disabled in production).

## Problems found and fixed

| Problem | Cause | Fix |
| --- | --- | --- |
| Nodes could not join the cluster | The public API endpoint was restricted to one IP and the private endpoint was off, so nodes in private subnets had no route to the API | `endpoint_private_access = true` in `modules/eks` |
| `kubectl` returned "must be logged in" | The cluster creator was the account root user, which gets no access entry | Created an access entry for the root ARN with `AmazonEKSClusterAdminPolicy` |
| MSK creation failed | Kafka `3.7.x` is no longer offered for standard brokers | Default `kafka_version` is now `3.9.x` |
| `docker build` failed while Terraform was running | The build context included the locked Terraform state | `infrastructure/terraform` added to `.dockerignore` (it also keeps state out of images) |
| Web pods restarted in a loop | The shared ConfigMap sets `PORT=4000` for the API, so the web server listened on the wrong port | `base/web.yaml` sets `PORT=3000` explicitly |
| Prometheus found no application pods | The monitoring kustomization forced every resource, including the pod-discovery Role, into the `monitoring` namespace | Namespace set per generated ConfigMap instead |
| `terraform destroy` would leave resources behind | RDS deletion protection and final snapshot, 7-day secret recovery window, non-empty ECR repositories | `ephemeral` variable in the prod environment |

## Teardown

Order matters: the load balancer is created by Kubernetes, not Terraform, and blocks the VPC deletion if it is left behind. If the data matters, take a manual RDS snapshot first — the 2026-11-17 teardown kept `agentops-prod-before-teardown-20261117`.

```bash
# 0. Optional, before deleting anything: keep the database.
aws rds create-db-snapshot --region ap-southeast-1 --db-instance-identifier <rds-id> \
  --db-snapshot-identifier agentops-prod-before-teardown-<yyyymmdd>

# 1. Remove everything that created AWS resources from inside the cluster.
kubectl delete namespace agentops monitoring
kubectl -n ingress-nginx delete svc ingress-nginx-controller
# wait until the load balancer is gone:
aws elbv2 describe-load-balancers --region ap-southeast-1 --query 'LoadBalancers[].LoadBalancerName'

# 2. Destroy the infrastructure (about 30 minutes).
cd infrastructure/terraform/environments/prod
terraform destroy

# 3. Remove what AWS created outside Terraform.
aws logs delete-log-group --region ap-southeast-1 --log-group-name /aws/eks/agentops-prod/cluster
```

Afterwards check that nothing billable is left: no EKS clusters, RDS instances, MSK clusters, ElastiCache groups, NAT gateways, load balancers or Elastic IPs in `ap-southeast-1`.

## For a long-lived production

- Set `ephemeral = false`, use the S3 backend from the `bootstrap` environment and run `apply` only through the CI workflow.
- Use a real domain and an IAM role (not the root user) for administration.
- Turn on `rds_multi_az`, use three MSK brokers and larger instance classes.
- Give Prometheus, Grafana and Tempo persistent volumes (the EBS CSI driver is not installed; they use `emptyDir` today).
- Enable VPC CNI network policy enforcement so the NetworkPolicies in the base take effect.
