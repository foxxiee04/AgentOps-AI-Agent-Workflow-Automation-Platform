# Kubernetes Base

`base/` holds the shared kustomize resources every overlay builds on:

- namespace `agentops`
- ConfigMap `agentops-config` (no secrets)
- one ServiceAccount per workload, token not mounted
- Deployments + Services for api, web, and the four workers, with probes, resources, pod security, and HPA
- Ingress (nginx + cert-manager TLS) and NetworkPolicies
- ExternalSecret `agentops-secrets` from ClusterSecretStore `agentops-secrets-store`

`secrets.example.env` lists the keys for a manual `kubectl create secret` on a local k3s. Keep environment-specific values (images, hosts, replicas) in the overlays.
