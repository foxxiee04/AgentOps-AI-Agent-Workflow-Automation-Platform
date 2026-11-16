# KEDA autoscaling (component)

This component adds KEDA `ScaledObject` resources for Kafka lag-based scaling and deletes the base CPU HPAs for `workflow-worker`, `ai-worker`, `tool-worker`, and `notification-worker`. The `agentops-api` HPA remains CPU-based.

- `ScaledObject` per worker: `minReplicaCount: 1`, `maxReplicaCount: 6`, `pollingInterval: 15`, `cooldownPeriod: 120`, scaleDown stabilization `120s`
- Kafka trigger per consumed topic with `lagThreshold: "50"`, `offsetResetPolicy: latest`, `allowIdleConsumers: "false"`
- `bootstrapServers` must point to MSK (set via overlay/patches; prod uses `REPLACE_WITH_MSK_BOOTSTRAP_BROKERS:9092` as a placeholder consistent with existing config)
- KEDA must be installed in the cluster (e.g., `kedacore/keda` Helm chart). The `keda.sh/scaledobject_v1alpha1` CRD schema is present in the datreeio CRD catalog used by `pnpm k8s:validate`.
