# Production Runbook (AWS EKS)

This runbook covers the operational lifecycle of the production environment running on AWS EKS: ephemeral bring-up, host configuration, credentials, in-cluster monitoring access, automated verification, troubleshooting history, and teardown procedures.

Related documentation:
- [AWS Kubernetes Deployment](aws-kubernetes-deployment.md): Infrastructure architecture, Terraform modules, and EKS add-ons.
- [Deployment and CI/CD](deployment.md): Container build specifications, CI/CD pipeline, and rollback policies.
- [Operations Runbook](runbook.md): Day-two alert triage and incident playbooks.
- [Production Verification Report](evidence/prod-verification.md): Automated verification results (27/27 checks passed).

---

## 1. Environment History and Architecture Status

The production stack is designed as an ephemeral environment (`ephemeral = true`) to enable full-fidelity end-to-end testing and portfolio showcases while keeping operational costs contained:

- **2026-11-16/17 (First Bring-Up)**: Initial infrastructure deployment via Terraform; resolved cluster access entries, private subnet routing, and container image boundaries.
- **2026-11-17 (Teardown & Cost Control)**: Infrastructure destroyed to eliminate standing compute and network costs. A manual RDS snapshot (`agentops-prod-before-teardown-20261117`) was preserved.
- **2026-11-17 (Second Bring-Up)**: Recreated the infrastructure with 54 Terraform resources in approximately 35 minutes (MSK Kafka cluster provisioning being the primary timing component). Deployed updated workloads featuring the Moss Atelier design system, workspace isolation, and the platform admin console.
- **2026-11-18 (Verification)**: 27 of 27 automated production checks passed (`scripts/verify-prod.mjs`).

### Infrastructure Specification

| Resource | Implementation | Details |
| --- | --- | --- |
| **Region** | `ap-southeast-1` (Singapore) | Multi-AZ deployment across 2 Availability Zones |
| **EKS Cluster** | Kubernetes 1.31 (`agentops-prod`) | 2 x `t3.medium` worker nodes deployed in private subnets |
| **Relational Database** | AWS RDS PostgreSQL 16 | `db.t4g.micro`, automated encryption, TLS enforced |
| **Caching Layer** | AWS ElastiCache Redis 7 | `cache.t4g.micro`, in-transit encryption (TLS) enabled |
| **Message Streaming** | AWS MSK (Managed Kafka 3.9.x) | 2 x `kafka.t3.small` brokers across 2 Availability Zones |
| **Ingress & TLS** | Ingress-NGINX + cert-manager | Network Load Balancer (NLB) with Let's Encrypt certificates |
| **Active Web URL** | `https://agentops.18-136-215-126.sslip.io` | Dynamically embeds NLB public IP address |
| **Active API URL** | `https://api.agentops.18-136-215-126.sslip.io` | Ingress routes API endpoints; blocks `/metrics` from internet |
| **Operating Cost** | Ephemeral profile | Approximately **USD 0.50 per hour** while running |

---

## 2. Step-by-Step Bring-Up Procedure

### Prerequisites
- AWS CLI configured with administrative credentials in `ap-southeast-1`.
- Terraform 1.9.8, `kubectl` v1.31, `helm`, and Docker.

### Step 1: Terraform Infrastructure Provisioning
Navigate to `infrastructure/terraform/environments/prod` and create `terraform.tfvars`:

```hcl
owner                    = "ops-lead"
github_repository        = "sangt/agentops"
ephemeral                = true
eks_public_access_cidrs  = ["0.0.0.0/0"]
```

Apply the Terraform plan:

```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```
*Provisioning completes in ~35 minutes across 54 AWS resources.*

### Step 2: Configure EKS Cluster Access
Update your local kubeconfig:

```bash
aws eks update-kubeconfig --name agentops-prod --region ap-southeast-1
```

If authenticating via an AWS root account or a distinct IAM role, ensure an EKS access entry exists with the `AmazonEKSClusterAdminPolicy` attached.

### Step 3: Install Cluster Add-Ons via Helm
Execute the add-on installations:

```bash
# 1. Metrics Server
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm install metrics-server metrics-server/metrics-server -n kube-system

# 2. Ingress-NGINX (Network Load Balancer)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="nlb"

# 3. cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 4. External Secrets Operator (IRSA authenticated)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="$(terraform output -raw external_secrets_role_arn)"

# 5. KEDA (Kafka Lag Autoscaler)
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda --namespace keda --create-namespace
```

### Step 4: Populate Application Secret in AWS Secrets Manager
Create the secret container `agentops/prod/app` via the AWS CLI or Console:

```json
{
  "DATABASE_URL": "postgresql://<user>:<pwd>@<rds_endpoint>:5432/agentops?sslmode=require&uselibpqcompat=true",
  "REDIS_URL": "<elasticache_redis_url>",
  "JWT_ACCESS_SECRET": "<generated-random-32-byte-hex>",
  "JWT_REFRESH_SECRET": "<generated-random-32-byte-hex>",
  "ALERTMANAGER_WEBHOOK_TOKEN": "<generated-token>",
  "PLATFORM_ADMIN_EMAILS": "admin@agentops.com,operator@agentops.local",
  "GOOGLE_OAUTH_CLIENT_ID": "<client-id>.apps.googleusercontent.com",
  "GOOGLE_OAUTH_CLIENT_SECRET": "<client-secret>"
}
```

External Secrets Operator synchronizes these keys directly into the Kubernetes Secret `agentops-secrets`.

### Step 5: Execute Application Deployment
Deploy workloads using the GitHub Actions pipeline or run manually:

```bash
REGISTRY="$(terraform output -raw ecr_registry)"
API_URL="https://api.agentops.<lb-ip-dashed>.sslip.io"

bash scripts/k8s-deploy.sh prod "<git-commit-sha>" "$REGISTRY" "$API_URL"
```

### Step 6: Deploy In-Cluster Monitoring Stack
Deploy Prometheus, Alertmanager, Grafana, and Tempo into the `monitoring` namespace:

```bash
kubectl create namespace monitoring
kubectl -n monitoring create secret generic alertmanager-webhook --from-literal=token="<ALERTMANAGER_WEBHOOK_TOKEN>"
kubectl -n monitoring create secret generic grafana-admin --from-literal=user=admin --from-literal=password="<secure-password>"
kubectl kustomize --load-restrictor LoadRestrictionsNone infrastructure/k8s/monitoring | kubectl apply --server-side -f -
```

---

## 3. Host-Change Checklist (After Every Bring-Up)

Because the Network Load Balancer (NLB) receives a new set of static public IPs on every provisioning cycle, the `sslip.io` hostname changes. Complete the following checklist immediately after bring-up:

| Component | Setting / Location | Value to Update |
| --- | --- | --- |
| **GitHub Actions** | Repository Variables | `PROD_WEB_HOST = agentops.<lb-ip-dashed>.sslip.io`<br/>`PROD_API_URL = https://api.agentops.<lb-ip-dashed>.sslip.io` |
| **Google Cloud Console** | Authorized JavaScript Origins | `https://agentops.<lb-ip-dashed>.sslip.io` |
| **Google Cloud Console** | Authorized Redirect URIs | `https://api.agentops.<lb-ip-dashed>.sslip.io/auth/google/callback` |
| **K8s Prod Overlay** | `infrastructure/k8s/overlays/prod/kustomization.yaml` | Ingress rule hostnames for web and API |
| **K8s ConfigMap** | `agentops-config` | `AUTH_COOKIE_DOMAIN = agentops.<lb-ip-dashed>.sslip.io`<br/>`GOOGLE_OAUTH_REDIRECT_URI = https://api.agentops.<lb-ip-dashed>.sslip.io/auth/google/callback`<br/>`DEMO_WORKSPACE_JOIN_ROLE = VIEWER` |

---

## 4. In-Cluster Access and Monitoring

Observability dashboards and metrics endpoints are strictly internal to the cluster and not exposed via public Ingress.

### Establishing Port-Forwards

```bash
# Grafana (Dashboards)
kubectl -n monitoring port-forward svc/grafana 3002:3000

# Prometheus (Metrics and Alerts)
kubectl -n monitoring port-forward svc/prometheus 9091:9090

# Alertmanager (Alerting Status)
kubectl -n monitoring port-forward svc/alertmanager 9093:9093
```

- **Grafana URL**: `http://localhost:3002` (Credentials: user `admin`, password retrieved from Secret `grafana-admin`).
- **Prometheus URL**: `http://localhost:9091` (Rules: 17 rules across 5 groups; Scrape targets: 7 active targets).

### Retrieving Credentials from Kubernetes Secrets

```bash
# Grafana admin credentials
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.password}' | base64 -d

# Production showcase user credentials
kubectl -n agentops get secret agentops-showcase-user -o jsonpath='{.data.email}' | base64 -d
kubectl -n agentops get secret agentops-showcase-user -o jsonpath='{.data.password}' | base64 -d
```

*Note: The showcase user holds the OWNER role in the demo workspace and is used for production demonstration flows (standard demo auto-login is disabled in production).*

---

## 5. Automated Production Verification (`scripts/verify-prod.mjs`)

The production verification script executes 27 comprehensive health and readiness checks across all layers:

```bash
KUBECONFIG=~/.kube/config node scripts/verify-prod.mjs --host agentops.18-136-215-126.sslip.io
```

### Verification Results Summary (2026-11-18)

| Check Category | Checks Passed | Key Verifications |
| --- | --- | --- |
| **Endpoints** | 6 / 6 | Web landing (200), API readiness (200), API liveness (200), protected routes (401), admin routes (401), metrics blocked at ingress (404) |
| **TLS** | 2 / 2 | Valid Let's Encrypt certificates with 90-day validity for both web and API hosts |
| **Workloads** | 7 / 7 | All 6 Deployments ready (`agentops-api` x2, `agentops-web` x2, 4 workers x1); 8 running pods; 0 restarts |
| **Autoscaling** | 2 / 2 | API CPU HPA (2-6 replicas); KEDA ScaledObjects active on Kafka lag for all 4 workers |
| **Prometheus** | 7 / 7 | 7 scrape targets UP (2 API, 4 workers, 1 Prometheus); 17 alert rules active; 0 warning/critical alerts firing; metrics recording |
| **Alerting** | 1 / 1 | Synthetic info alert sent from Alertmanager delivered successfully to API webhook (`agentops_alertmanager_notifications_total` incremented) |
| **Tracing** | 2 / 2 | 5 services actively exporting spans to Tempo; end-to-end trace verified across API and worker boundaries |
| **Total** | **27 / 27** | **100% PASS** (Full report: [docs/evidence/prod-verification.md](evidence/prod-verification.md)) |

---

## 6. Problems Found and Fixed

During the first and second bring-up operations, several edge cases were identified and permanently resolved in code and configuration:

| Problem Encountered | Root Cause Analysis | Implemented Resolution |
| --- | --- | --- |
| **EKS Nodes failed to join cluster** | Public API endpoint had restrictive CIDRs and private endpoint was disabled, leaving worker nodes in private subnets with no route to the control plane. | Set `endpoint_private_access = true` in `infrastructure/terraform/modules/eks`. |
| **`kubectl` returned "must be logged in"** | The AWS account root ARN created the cluster, but root users do not receive an automatic EKS Access Entry. | Created an explicit EKS Access Entry for the IAM principal with `AmazonEKSClusterAdminPolicy`. |
| **MSK Cluster creation failed** | Kafka version `3.7.x` was deprecated and unavailable for standard broker provisioning in `ap-southeast-1`. | Updated default `kafka_version` to `3.9.x` in `infrastructure/terraform/modules/msk`. |
| **Docker build failed during Terraform runs** | The Docker context included the directory containing the locked local Terraform state. | Added `infrastructure/terraform` to `.dockerignore` (also prevents credential exposure in images). |
| **Web pods crash-looping** | Shared ConfigMap defined `PORT=4000` for the API, causing the Next.js web server to bind to port 4000 instead of 3000. | Explicitly declared `PORT=3000` in `infrastructure/k8s/base/web.yaml`. |
| **Prometheus unable to scrape application pods** | Kustomization forced all monitoring manifests into the `monitoring` namespace, including the Pod discovery ClusterRole. | Scoped namespace bindings per generated ConfigMap and service account. |
| **`terraform destroy` hung on residual resources** | RDS deletion protection, automated final snapshots, non-empty ECR repositories, and a 7-day secret recovery window blocked deletion. | Added the `ephemeral` variable to toggle deletion protection, force-delete ECR repositories, and set `recovery_window_in_days = 0`. |

---

## 7. Teardown Procedure

To cleanly terminate all billable AWS infrastructure without leaving dangling network resources, follow this strict sequence:

```bash
# Step 0: Create manual RDS backup snapshot (optional, if retaining data)
aws rds create-db-snapshot --region ap-southeast-1 \
  --db-instance-identifier agentops-prod-postgres \
  --db-snapshot-identifier agentops-prod-before-teardown-$(date +%Y%m%d)

# Step 1: Delete in-cluster services that own external cloud resources
# CRITICAL: Deleting the Ingress service deletes the AWS Network Load Balancer.
# Leaving the NLB behind blocks VPC internet gateway deletion.
kubectl -n ingress-nginx delete svc ingress-nginx-controller
kubectl delete namespace agentops monitoring

# Wait until AWS confirms the Network Load Balancer is deleted:
aws elbv2 describe-load-balancers --region ap-southeast-1 \
  --query 'LoadBalancers[?contains(LoadBalancerName, `k8s`)].LoadBalancerName'

# Step 2: Destroy Terraform infrastructure
cd infrastructure/terraform/environments/prod
terraform destroy -auto-approve

# Step 3: Remove CloudWatch log groups created directly by EKS
aws logs delete-log-group --region ap-southeast-1 \
  --log-group-name /aws/eks/agentops-prod/cluster

# Step 4: Verify zero billable resources remain
aws eks list-clusters --region ap-southeast-1
aws rds describe-db-instances --region ap-southeast-1
aws kafka list-clusters --region ap-southeast-1
aws elasticache describe-cache-clusters --region ap-southeast-1
```

---

## 8. Transitioning to Long-Lived Production

For continuous, 24/7 production operation, apply the following configuration changes:

1. **State Storage**: Set `ephemeral = false` and configure the S3 remote backend with DynamoDB locking via `infrastructure/terraform/environments/bootstrap`.
2. **Domain & DNS**: Replace `sslip.io` with a custom domain hosted on AWS Route 53, using cert-manager with DNS-01 challenges or AWS ACM.
3. **Database & Brokers**: Enable `rds_multi_az = true` and expand the MSK cluster to 3 brokers across 3 Availability Zones.
4. **Persistent Volumes**: Install the AWS EBS CSI driver to provide durable storage for Prometheus TSDB, Grafana dashboards, and Tempo trace blocks (currently using `emptyDir`).
5. **Network Policy Enforcement**: Enable Amazon VPC CNI network policy support (`enable_network_policy = true`) to enforce intra-cluster pod isolation rules.
