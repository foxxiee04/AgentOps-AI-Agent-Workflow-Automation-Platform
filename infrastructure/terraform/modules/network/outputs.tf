output "vpc_id" {
  description = "The VPC id."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "The VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Ids of the public subnets, ordered by availability zone."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Ids of the private subnets, ordered by availability zone."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_id" {
  description = "The NAT gateway id, or null when NAT is disabled."
  value       = var.enable_nat ? aws_nat_gateway.this[0].id : null
}
