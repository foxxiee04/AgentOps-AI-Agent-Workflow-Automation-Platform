resource "aws_instance" "k3s" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.security_group_ids
  key_name               = var.key_name

  user_data = <<-EOF
    #!/bin/bash
    set -eux
    curl -sfL https://get.k3s.io | sh -
  EOF

  tags = {
    Name = "${var.name}-k3s"
  }
}

