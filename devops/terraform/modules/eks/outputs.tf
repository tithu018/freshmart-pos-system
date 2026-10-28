output "cluster_name" {
  value = aws_eks_cluster.this.name
}
output "endpoint" {
  value = aws_eks_cluster.this.endpoint
}
output "certificate_authority" {
  value = aws_eks_cluster.this.certificate_authority[0].data
}
output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.this.arn
}
output "node_security_group_id" {
  value = aws_security_group.nodes.id
}
output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
output "node_role_arn" {
  value = aws_iam_role.nodes.arn
}
output "node_group_names" {
  value = { for name, group in aws_eks_node_group.this : name => group.node_group_name }
}
