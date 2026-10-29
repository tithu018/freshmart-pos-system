provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]

  # Use the normal AWS credential chain (prefer SSO/assumed roles).
  # Never put access keys or session tokens in Terraform files.
  default_tags {
    tags = merge(var.tags, {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    })
  }
}
