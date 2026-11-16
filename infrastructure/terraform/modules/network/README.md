# Network Module

Creates a VPC with public and private subnets spread across the given availability
zones, an internet gateway, and public routing. When `enable_nat` is true it also
creates a single NAT gateway (and Elastic IP) in the first public subnet plus
private route table egress through it.

Public subnets are tagged for external load balancers and private subnets for
internal load balancers. Set `enable_nat = false` (default) for the low-cost EC2 +
k3s path with no NAT charges.

Both `public_subnet_cidrs` and `private_subnet_cidrs` must contain exactly one
CIDR per availability zone in `azs`.
