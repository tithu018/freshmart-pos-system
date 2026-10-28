# All synthetic data. These mocks make no AWS calls and hold no credentials.
mock_data "aws_partition" {
  defaults = { partition = "aws", dns_suffix = "amazonaws.com" }
}
mock_data "aws_eks_addon_version" {
  defaults = { version = "v1.0.0-eksbuild.1" }
}
mock_resource "aws_eks_cluster" {
  defaults = {
    arn                   = "arn:aws:eks:ap-south-1:123456789012:cluster/freshmart-test"
    endpoint              = "https://api.example.test"
    identity              = [{ oidc = [{ issuer = "https://oidc.eks.ap-south-1.amazonaws.com/id/TEST" }] }]
    certificate_authority = [{ data = "bW9jay1jYQ==" }]
  }
}
mock_resource "aws_iam_role" {
  defaults = { arn = "arn:aws:iam::123456789012:role/mock-role" }
}
mock_resource "aws_iam_openid_connect_provider" {
  defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-south-1.amazonaws.com/id/TEST" }
}
mock_resource "aws_db_instance" {
  defaults = {
    address = "database.example.test"
    master_user_secret = [{
      secret_arn    = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:mock-reference"
      secret_status = "active"
      kms_key_id    = "arn:aws:kms:ap-south-1:123456789012:key/mock-key"
    }]
  }
}
