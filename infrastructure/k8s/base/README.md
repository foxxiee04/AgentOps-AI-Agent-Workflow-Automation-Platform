# Kubernetes Base

Base manifests should define shared Kubernetes resources before environment-specific overrides.

Use this folder for:

- Deployments
- Services
- ConfigMaps
- Secret templates
- Ingress base
- PersistentVolumeClaim templates
- HorizontalPodAutoscaler templates

Keep environment-specific values in overlays.

## Current Base Files

- `namespace.yaml`
- `configmap.yaml`
- `secrets.example.yaml`
- `data.yaml`
- `apps.yaml`
- `ingress.yaml`

`secrets.example.yaml` contains placeholder values only. Replace them through an overlay, sealed secret, external secret operator, or manual `kubectl create secret` before a real deployment.
