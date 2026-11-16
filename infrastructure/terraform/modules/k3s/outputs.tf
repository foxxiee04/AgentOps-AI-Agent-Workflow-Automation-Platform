output "instance_id" {
  description = "Id of the k3s EC2 instance."
  value       = aws_instance.this.id
}

output "public_ip" {
  description = "Elastic IP address associated with the k3s instance."
  value       = aws_eip.this.public_ip
}

output "security_group_id" {
  description = "Id of the k3s host security group."
  value       = aws_security_group.this.id
}
