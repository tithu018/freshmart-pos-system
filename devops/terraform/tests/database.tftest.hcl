mock_provider "aws" {
  override_during = plan
  source          = "./tests/mocks"
}
variables {
  name                      = "freshmart-test"
  vpc_id                    = "vpc-0123456789abcdef0"
  database_subnet_ids       = ["subnet-0123456789abcdef2", "subnet-0123456789abcdef3"]
  node_security_group_id    = "sg-0123456789abcdef0"
  db_name                   = "freshmart_pos"
  master_username           = "freshmart_admin"
  instance_class            = "db.t4g.micro"
  multi_az                  = false
  allocated_storage         = 20
  max_allocated_storage     = 100
  deletion_protection       = true
  final_snapshot_identifier = "freshmart-test-final"
}

run "private_encrypted_managed_credentials" {
  command = plan
  module { source = "./modules/database" }
  assert {
    condition     = !aws_db_instance.this.publicly_accessible && aws_db_instance.this.storage_encrypted && aws_db_instance.this.manage_master_user_password && aws_db_instance.this.password == null
    error_message = "RDS must be private/encrypted with AWS-managed credentials and no Terraform password."
  }
  assert {
    condition     = aws_db_instance.this.deletion_protection && !aws_db_instance.this.skip_final_snapshot && aws_db_instance.this.backup_retention_period >= 7
    error_message = "RDS must retain backups and require an explicit protected decommission."
  }
  assert {
    condition     = aws_vpc_security_group_ingress_rule.postgresql.referenced_security_group_id == var.node_security_group_id && aws_vpc_security_group_ingress_rule.postgresql.from_port == 5432 && aws_vpc_security_group_ingress_rule.postgresql.cidr_ipv4 == null
    error_message = "Database ingress must use the worker group reference, never a public CIDR."
  }
  assert {
    condition     = one(aws_db_parameter_group.this.parameter).name == "rds.force_ssl" && one(aws_db_parameter_group.this.parameter).value == "1"
    error_message = "Database connections must require TLS."
  }
}

run "multi_az_option" {
  command = plan
  module { source = "./modules/database" }
  variables { multi_az = true }
  assert {
    condition     = aws_db_instance.this.multi_az
    error_message = "The optional RDS standby must be enabled when requested."
  }
}
