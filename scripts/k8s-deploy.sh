#!/usr/bin/env bash
#
# Build-time image tags are set here, then the migration Job runs before the
# Deployments are rolled out. If the rollout or the smoke test fails, every
# Deployment is rolled back and the script exits non-zero.
#
# Usage: k8s-deploy.sh <env> <tag> <registry> <api_url>
#
# Environment variables (all optional). They fill the placeholders of the
# manifests in the temporary copy that gets deployed, never the repository:
#   DEPLOY_WEB_HOST      Public host of the deployment, e.g. agentops.mycompany.io.
#                        Replaces agentops.example.com (prod only).
#   DEPLOY_KAFKA_BROKERS MSK bootstrap brokers, e.g. b-1.x:9092,b-2.x:9092.
#                        Replaces REPLACE_WITH_MSK_BOOTSTRAP_BROKERS:9092.
#   DEPLOY_REDIS_URL     ElastiCache URL, e.g. rediss://host:6379.
#                        Replaces redis://REPLACE_WITH_ELASTICACHE_ENDPOINT:6379.
#   DEPLOY_ACME_EMAIL    Contact address of the ACME (Let's Encrypt) issuer,
#                        e.g. ops@mycompany.io. Optional: when it is empty the
#                        placeholder email is removed from the ClusterIssuer.
#
# The rendered manifests are checked before anything is applied: the script
# refuses to deploy while a placeholder is still left in them.
set -euo pipefail

env="${1:?usage: k8s-deploy.sh <env> <tag> <registry> <api_url>}"
tag="${2:?usage: k8s-deploy.sh <env> <tag> <registry> <api_url>}"
registry="${3:?usage: k8s-deploy.sh <env> <tag> <registry> <api_url>}"
api_url="${4:?usage: k8s-deploy.sh <env> <tag> <registry> <api_url>}"

namespace="agentops"
apps=(api web workflow-worker ai-worker tool-worker notification-worker)
deployments=(agentops-api agentops-web workflow-worker ai-worker tool-worker notification-worker)

workdir="$(mktemp -d)"
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

cp -R infrastructure/k8s/. "$workdir/"

# Escape the characters that are special in the replacement half of a sed
# expression, so a value can never inject an extra replacement.
escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

# 0. Fill the environment specific values into the copy that is deployed, so
#    that a placeholder can never reach the cluster.
if [ "$env" = "prod" ] && [ -n "${DEPLOY_WEB_HOST:-}" ]; then
  host="$(escape_sed_replacement "$DEPLOY_WEB_HOST")"
  find "$workdir" -name '*.yaml' -print0 | xargs -0 -r sed -i "s|agentops\.example\.com|${host}|g"
fi

if [ -n "${DEPLOY_KAFKA_BROKERS:-}" ]; then
  brokers="$(escape_sed_replacement "$DEPLOY_KAFKA_BROKERS")"
  find "$workdir" -name '*.yaml' -print0 | xargs -0 -r sed -i "s|REPLACE_WITH_MSK_BOOTSTRAP_BROKERS:9092|${brokers}|g"
fi

if [ -n "${DEPLOY_REDIS_URL:-}" ]; then
  redis="$(escape_sed_replacement "$DEPLOY_REDIS_URL")"
  find "$workdir" -name '*.yaml' -print0 | xargs -0 -r sed -i "s|redis://REPLACE_WITH_ELASTICACHE_ENDPOINT:6379|${redis}|g"
fi

issuer="$workdir/overlays/$env/cluster-issuer.yaml"
if [ -f "$issuer" ]; then
  if [ -n "${DEPLOY_ACME_EMAIL:-}" ]; then
    email="$(escape_sed_replacement "$DEPLOY_ACME_EMAIL")"
    sed -i "s|ops@example\.com|${email}|g" "$issuer"
  else
    # The ACME contact address is optional: drop the placeholder line and the
    # comment right above it.
    sed -i \
      -e '/^[[:space:]]*# Placeholder contact address\.$/d' \
      -e '/^[[:space:]]*email: ops@example\.com$/d' \
      "$issuer"
  fi
fi

# 1. Point the overlay (6 app images) and the migration Job (tools) at the
#    images that were just pushed.
for app in "${apps[@]}"; do
  (cd "$workdir/overlays/$env" && kustomize edit set image "agentops/$app=$registry/$env/$app:$tag")
done
(cd "$workdir/jobs/db-migrate" && kustomize edit set image "agentops/tools=$registry/$env/tools:$tag")

# 2. Render the overlay once and refuse to deploy while a placeholder is left.
rendered="$workdir/rendered.yaml"
kustomize build "$workdir/overlays/$env" > "$rendered"

missing=""
if grep -q 'REPLACE_WITH_MSK_BOOTSTRAP_BROKERS' "$rendered"; then
  missing="${missing}  - DEPLOY_KAFKA_BROKERS: MSK bootstrap brokers, for example b-1.x:9092,b-2.x:9092"$'\n'
fi
if grep -q 'REPLACE_WITH_ELASTICACHE_ENDPOINT' "$rendered"; then
  missing="${missing}  - DEPLOY_REDIS_URL: ElastiCache URL, for example rediss://host:6379"$'\n'
fi
if [ "$env" = "prod" ] && grep -q 'agentops\.example\.com' "$rendered"; then
  missing="${missing}  - DEPLOY_WEB_HOST: public host name, for example agentops.mycompany.io"$'\n'
fi
if [ "$env" = "prod" ] && grep -q '000000000000' "$rendered"; then
  missing="${missing}  - the registry argument: ECR registry to deploy from (the placeholder account id is still in the overlay)"$'\n'
fi

if [ -n "$missing" ]; then
  {
    echo "ERROR: the $env overlay still contains placeholders, so nothing was deployed."
    echo "Set the following environment variables and run the deployment again:"
    printf '%s' "$missing"
  } >&2
  exit 1
fi

# 3. Run the migration Job before touching the applications.
kubectl -n "$namespace" delete job agentops-db-migrate --ignore-not-found
kustomize build "$workdir/jobs/db-migrate" | kubectl apply -f -
if ! kubectl -n "$namespace" wait --for=condition=complete job/agentops-db-migrate --timeout=300s; then
  echo "ERROR: migration Job agentops-db-migrate did not complete" >&2
  kubectl -n "$namespace" logs job/agentops-db-migrate --all-containers --tail=-1 >&2 || true
  exit 1
fi

# 4. Roll out the applications, recording the images that were running before.
previous_images="$(kubectl -n "$namespace" get deploy -o jsonpath='{range .items[*]}{.metadata.name}{"="}{.spec.template.spec.containers[0].image}{"\n"}{end}')"
echo "Images before rollout:"
echo "$previous_images"

kubectl apply -f "$rendered"

deploy_failed=0
for deploy in "${deployments[@]}"; do
  kubectl -n "$namespace" rollout status "deploy/$deploy" --timeout=180s || deploy_failed=1
done

# 5. Smoke test the API through the ingress.
if [ "$deploy_failed" -eq 0 ]; then
  curl -fsS --retry 10 --retry-delay 6 "$api_url/health/ready" || deploy_failed=1
  curl -fsS "$api_url/health/live" || deploy_failed=1
fi

# 6. Roll everything back if the rollout or the smoke test failed.
if [ "$deploy_failed" -ne 0 ]; then
  echo "Rollout or smoke test failed; rolling back:" >&2
  for deploy in "${deployments[@]}"; do
    kubectl -n "$namespace" rollout undo "deploy/$deploy" || true
  done
  for deploy in "${deployments[@]}"; do
    kubectl -n "$namespace" rollout status "deploy/$deploy" --timeout=180s || true
  done
  echo "ROLLED BACK" >&2
  exit 1
fi

echo "Deployed $env at $tag from $registry."
