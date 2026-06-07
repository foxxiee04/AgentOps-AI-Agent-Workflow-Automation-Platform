output "k3s_public_ip" {
  value = module.compute.public_ip
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
