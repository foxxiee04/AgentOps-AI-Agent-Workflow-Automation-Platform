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
- `apps.yaml`
- `ingress.yaml`
