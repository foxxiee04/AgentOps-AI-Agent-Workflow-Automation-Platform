# ElastiCache Module

Creates a Redis replication group on private subnets, a cache subnet group, and a
security group that allows port 6379 only from `allowed_cidr_blocks` (egress open).

Encryption at rest and in transit are both enabled, so clients must connect over
TLS. Automatic failover is enabled only when `num_cache_clusters > 1` (a single
node cannot fail over). A one-day snapshot retention window is kept.

`redis_url` is emitted as a `rediss://` URL for TLS clients.

## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `name` | Name prefix for resources | n/a |
| `vpc_id` | VPC id | n/a |
| `subnet_ids` | Private subnet ids for the subnet group | n/a |
| `allowed_cidr_blocks` | CIDRs allowed to reach 6379 | n/a |
| `tags` | Tags for taggable resources | `{}` |
| `engine_version` | Redis version | `"7.1"` |
| `node_type` | Node type | `"cache.t4g.micro"` |
| `num_cache_clusters` | Node count | `1` |
