locals {
  name = "${var.project}-${var.environment}"
}

module "network" {
  source             = "./modules/network"
  name               = local.name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  nat_gateway_mode   = var.nat_gateway_mode
  aws_region         = var.aws_region
}

module "eks" {
  source                  = "./modules/eks"
  name                    = local.name
  vpc_id                  = module.network.vpc_id
  vpc_cidr                = var.vpc_cidr
  private_subnet_ids      = module.network.private_subnet_ids
  kubernetes_version      = var.eks_version
  cluster_admin_role_arns = var.cluster_admin_role_arns
  endpoint_public_access  = var.eks_public_access
  public_access_cidrs     = var.eks_public_access_cidrs
  private_access_cidrs    = var.eks_private_access_cidrs
  node_groups             = var.node_groups
  alb_ingress_cidrs       = var.alb_ingress_cidrs
}

module "database" {
  source                    = "./modules/database"
  name                      = local.name
  vpc_id                    = module.network.vpc_id
  database_subnet_ids       = module.network.database_subnet_ids
  node_security_group_id    = module.eks.node_security_group_id
  db_name                   = var.db_name
  master_username           = var.db_master_username
  instance_class            = var.db_instance_class
  multi_az                  = var.db_multi_az
  allocated_storage         = var.db_allocated_storage
  max_allocated_storage     = var.db_max_allocated_storage
  deletion_protection       = var.db_deletion_protection
  final_snapshot_identifier = coalesce(var.db_final_snapshot_identifier, "${local.name}-final")
}

resource "aws_vpc_security_group_egress_rule" "nodes_to_database" {
  security_group_id            = module.eks.node_security_group_id
  referenced_security_group_id = module.database.security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL only to the private FreshMart RDS security group"
}
