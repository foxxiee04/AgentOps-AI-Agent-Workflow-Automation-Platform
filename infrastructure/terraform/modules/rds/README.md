# RDS Module

Creates a PostgreSQL RDS instance on private subnets, a DB subnet group, and a
security group that allows port 5432 only from `allowed_cidr_blocks` (egress open).

The master password is managed by RDS in Secrets Manager via
`manage_master_user_password = true`, so no password ever lives in code or state.
The instance is not publicly accessible, encrypts storage with gp3, and keeps a
final snapshot (`${name}-final`) on deletion. Deletion protection is on by default.

Outputs include the endpoint, address, port, database name, and the Secrets Manager
ARN holding the master credentials.

## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `name` | Name prefix for resources | n/a |
| `vpc_id` | VPC id | n/a |
| `subnet_ids` | Private subnet ids for the subnet group | n/a |
| `allowed_cidr_blocks` | CIDRs allowed to reach 5432 | n/a |
| `tags` | Tags for taggable resources | `{}` |
| `engine_version` | PostgreSQL version | `"16"` |
| `instance_class` | Instance class | `"db.t4g.micro"` |
| `allocated_storage` | Storage in GiB | `20` |
| `max_allocated_storage` | Autoscaling ceiling in GiB | `100` |
| `multi_az` | Multi-AZ standby | `false` |
| `deletion_protection` | Block accidental deletion | `true` |
| `backup_retention_days` | Backup retention | `7` |
| `db_name` | Initial database name | `"agentops"` |
| `username` | Master username | `"agentops"` |
