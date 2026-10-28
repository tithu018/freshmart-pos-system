output "aws_region" {
  description = "Region containing this environment."
  value       = var.aws_region
}

output "network" {
  description = "Subnet tiers, VPC and NAT details. Database subnets have no internet default route."
  value = {
    vpc_id              = module.network.vpc_id
    public_subnet_ids   = module.network.public_subnet_ids
    private_subnet_ids  = module.network.private_subnet_ids
    database_subnet_ids = module.network.database_subnet_ids
    nat_public_ips      = module.network.nat_public_ips
  }
}

output "eks" {
  description = "Cluster connection details and infrastructure role ARNs; no credentials."
  value = {
    cluster_name           = module.eks.cluster_name
    endpoint               = module.eks.endpoint
    certificate_authority  = module.eks.certificate_authority
    oidc_provider_arn      = module.eks.oidc_provider_arn
    node_security_group_id = module.eks.node_security_group_id
    alb_security_group_id  = module.eks.alb_security_group_id
    node_role_arn          = module.eks.node_role_arn
    node_group_names       = module.eks.node_group_names
  }
}

output "database" {
  description = "Private RDS connection metadata. The managed secret ARN is a reference, not its value."
  value = {
    identifier        = module.database.identifier
    address           = module.database.address
    port              = module.database.port
    db_name           = var.db_name
    security_group_id = module.database.security_group_id
    master_secret_arn = module.database.master_secret_arn
  }
}

output "configure_kubectl_command" {
  description = "For a future authorized deployment, with VPC network access when the API is private."
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
