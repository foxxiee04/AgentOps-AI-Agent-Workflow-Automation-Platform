# MSK Module

Creates an MSK (Kafka) cluster across the given private subnets, a configuration
with sane defaults, and a security group that allows the broker ports 9092
(plaintext) and 9094 (TLS) only from `allowed_cidr_blocks` (egress open).

Broker count equals `length(subnet_ids)`, matching brokers to subnets.

The cluster configuration disables automatic topic creation, sets a replication
factor of 2, a minimum in-sync replica count of 1, and 3 partitions by default.

Encryption in transit uses `client_broker = "TLS_PLAINTEXT"`: kafkajs in this repo
connects without TLS inside the VPC. Switch to `TLS` when hardening.

## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `name` | Name prefix for resources | n/a |
| `vpc_id` | VPC id | n/a |
| `subnet_ids` | Private subnet ids / broker count | n/a |
| `allowed_cidr_blocks` | CIDRs allowed to reach 9092/9094 | n/a |
| `tags` | Tags for taggable resources | `{}` |
| `kafka_version` | Kafka version | `"3.9.x"` |
| `broker_instance_type` | Broker instance type | `"kafka.t3.small"` |
| `broker_volume_gb` | EBS volume per broker (GiB) | `20` |

## Outputs

- `bootstrap_brokers` - plaintext bootstrap string.
- `bootstrap_brokers_tls` - TLS bootstrap string.
- `cluster_arn` - cluster ARN.
