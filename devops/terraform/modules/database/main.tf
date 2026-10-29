resource "aws_security_group" "this" {
  name_prefix = "${var.name}-database-"
  description = "Private PostgreSQL; only EKS node/pod security group may connect"
  vpc_id      = var.vpc_id
  # No unsolicited outbound connections. Reply traffic is statefully permitted.
  tags = { Name = "${var.name}-database" }
}

resource "aws_vpc_security_group_ingress_rule" "postgresql" {
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.node_security_group_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from the FreshMart EKS worker security group only"
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.database_subnet_ids
  tags       = { Name = var.name }
}

resource "aws_db_parameter_group" "this" {
  name_prefix = "${var.name}-postgres17-"
  family      = "postgres17"
  description = "FreshMart PostgreSQL 17 requires TLS"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/instance/${var.name}/postgresql"
  retention_in_days = 30
}

resource "aws_db_instance" "this" {
  identifier                  = var.name
  engine                      = "postgres"
  engine_version              = "17"
  engine_lifecycle_support    = "open-source-rds-extended-support-disabled"
  instance_class              = var.instance_class
  db_name                     = var.db_name
  username                    = var.master_username
  manage_master_user_password = true
  # RDS generates/rotates the password in Secrets Manager. Terraform never reads it.
  port                            = 5432
  publicly_accessible             = false
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.this.id]
  parameter_group_name            = aws_db_parameter_group.this.name
  multi_az                        = var.multi_az
  storage_type                    = "gp3"
  storage_encrypted               = true
  allocated_storage               = var.allocated_storage
  max_allocated_storage           = var.max_allocated_storage
  backup_retention_period         = 7
  backup_window                   = "19:00-20:00"
  maintenance_window              = "sun:20:00-sun:21:00"
  auto_minor_version_upgrade      = true
  allow_major_version_upgrade     = false
  apply_immediately               = false
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = false
  final_snapshot_identifier       = var.final_snapshot_identifier
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags                            = { Name = var.name }
  depends_on                      = [aws_cloudwatch_log_group.postgresql]
}
