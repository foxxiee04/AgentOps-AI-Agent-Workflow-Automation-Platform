# k3s Module

Runs a single-node k3s cluster on one EC2 instance for the dev / low-cost demo
environment. The node is attached to an Elastic IP and accessed through SSM
Session Manager, so no SSH ingress is opened.

- Security group: HTTP (80) and HTTPS (443) from `ingress_cidr_blocks`,
  Kubernetes API (6443) from `admin_cidr_blocks`, all egress.
- IAM: EC2 role and instance profile with `AmazonSSMManagedInstanceCore`
  (Session Manager) and `AmazonEC2ContainerRegistryReadOnly` (pull images).
- Instance: Ubuntu 24.04 (`ami_id` passed in, no AMI data source), encrypted
  gp3 root volume, IMDSv2 required, detailed monitoring enabled, and user data
  that installs k3s with `--disable traefik --write-kubeconfig-mode 600`
  (ingress-nginx is installed separately).

Kubernetes API access is limited to `admin_cidr_blocks`; shell access is via
SSM Session Manager only.

## Inputs

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| `name` | Name prefix for the k3s host resources. | `string` | n/a |
| `tags` | Tags applied to all taggable resources. | `map(string)` | `{}` |
| `vpc_id` | VPC id the k3s host runs in. | `string` | n/a |
| `subnet_id` | Public subnet id for the k3s host. | `string` | n/a |
| `ami_id` | Ubuntu 24.04 AMI id (passed in; no data source). | `string` | n/a |
| `instance_type` | EC2 instance type. | `string` | `"t3.large"` |
| `root_volume_gb` | Encrypted gp3 root volume size in GiB. | `number` | `50` |
| `ingress_cidr_blocks` | CIDRs allowed to reach HTTP/HTTPS. | `list(string)` | `["0.0.0.0/0"]` |
| `admin_cidr_blocks` | CIDRs allowed to reach the Kubernetes API (6443). | `list(string)` | n/a |

## Outputs

| Name | Description |
| --- | --- |
| `instance_id` | Id of the k3s EC2 instance. |
| `public_ip` | Elastic IP associated with the k3s instance. |
| `security_group_id` | Id of the k3s host security group. |
