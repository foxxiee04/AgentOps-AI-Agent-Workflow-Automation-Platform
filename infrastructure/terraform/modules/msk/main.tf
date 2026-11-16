resource "aws_security_group" "this" {
  name        = "${var.name}-kafka-sg"
  description = "Kafka access for ${var.name}"
  vpc_id      = var.vpc_id

  ingress {
    description = "Kafka plaintext"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  ingress {
    description = "Kafka TLS"
    from_port   = 9094
    to_port     = 9094
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-kafka-sg" })
}

resource "aws_msk_configuration" "this" {
  name = "${var.name}-kafka-config"

  server_properties = join("\n", [
    "auto.create.topics.enable=false",
    "default.replication.factor=2",
    "min.insync.replicas=1",
    "num.partitions=3",
  ])
}

resource "aws_msk_cluster" "this" {
  cluster_name           = "${var.name}-kafka"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = length(var.subnet_ids)

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.this.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_volume_gb
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  encryption_info {
    encryption_in_transit {
      # kafkajs in this repo connects without TLS inside the VPC;
      # switch to TLS when hardening.
      client_broker = "TLS_PLAINTEXT"
      in_cluster    = true
    }
  }

  tags = merge(var.tags, { Name = "${var.name}-kafka" })
}
