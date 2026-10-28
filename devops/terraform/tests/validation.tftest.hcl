mock_provider "aws" {
  override_during = plan
  source          = "./tests/mocks"
}
variables {
  aws_account_id          = "123456789012"
  cluster_admin_role_arns = ["arn:aws:iam::123456789012:role/test-admin"]
}

run "root_module_wiring" {
  command = plan
  assert {
    condition     = length(output.network.public_subnet_ids) == 2 && length(output.network.database_subnet_ids) == 2 && output.database.db_name == "freshmart_pos" && aws_vpc_security_group_egress_rule.nodes_to_database.to_port == 5432
    error_message = "Root modules must expose both subnet tiers and wire PostgreSQL access."
  }
}

run "reject_open_public_api" {
  command = plan
  variables {
    eks_public_access       = true
    eks_public_access_cidrs = ["0.0.0.0/0"]
  }
  expect_failures = [var.eks_public_access_cidrs]
}

run "reject_missing_public_allowlist" {
  command = plan
  variables { eks_public_access = true }
  expect_failures = [var.eks_public_access_cidrs]
}

run "reject_invalid_scaling" {
  command = plan
  variables { node_groups = { general = { min_size = 3, desired_size = 2, max_size = 1 } } }
  expect_failures = [var.node_groups]
}

run "reject_undersized_storage_cap" {
  command = plan
  variables { db_max_allocated_storage = 20 }
  expect_failures = [var.db_max_allocated_storage]
}

run "reject_wrong_region_azs" {
  command = plan
  variables { availability_zones = ["us-east-1a", "us-east-1b"] }
  expect_failures = [var.availability_zones]
}

run "reject_implicit_admin" {
  command = plan
  variables { cluster_admin_role_arns = [] }
  expect_failures = [var.cluster_admin_role_arns]
}
