output "primary_endpoint" {
  description = "Primary endpoint address of the replication group."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "redis_url" {
  description = "TLS Redis connection URL."
  value       = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
}
