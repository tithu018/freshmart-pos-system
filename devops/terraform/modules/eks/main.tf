data "aws_partition" "current" {}

resource "aws_iam_role" "cluster" {
  name = "${var.name}-eks-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "nodes" {
  name = "${var.name}-eks-nodes"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "nodes" {
  for_each   = toset(["AmazonEKSWorkerNodePolicy", "AmazonEC2ContainerRegistryPullOnly"])
  role       = aws_iam_role.nodes.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/${each.key}"
}

resource "aws_cloudwatch_log_group" "cluster" {
  name              = "/aws/eks/${var.name}/cluster"
  retention_in_days = 30
}

resource "aws_eks_cluster" "this" {
  name                          = var.name
  role_arn                      = aws_iam_role.cluster.arn
  version                       = var.kubernetes_version
  bootstrap_self_managed_addons = false
  enabled_cluster_log_types     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = false
  }

  upgrade_policy {
    support_type = "STANDARD"
  }

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    security_group_ids      = [aws_security_group.control_plane.id]
    endpoint_private_access = true
    endpoint_public_access  = var.endpoint_public_access
    public_access_cidrs     = var.endpoint_public_access ? var.public_access_cidrs : null
  }

  depends_on = [aws_iam_role_policy_attachment.cluster, aws_cloudwatch_log_group.cluster]
}

resource "aws_eks_access_entry" "admins" {
  for_each      = var.cluster_admin_role_arns
  cluster_name  = aws_eks_cluster.this.name
  principal_arn = each.value
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "admins" {
  for_each      = var.cluster_admin_role_arns
  cluster_name  = aws_eks_cluster.this.name
  principal_arn = aws_eks_access_entry.admins[each.key].principal_arn
  policy_arn    = "arn:${data.aws_partition.current.partition}:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
  access_scope {
    type = "cluster"
  }
}

resource "aws_iam_openid_connect_provider" "this" {
  url            = aws_eks_cluster.this.identity[0].oidc[0].issuer
  client_id_list = ["sts.amazonaws.com"]
  # IAM retrieves the issuer certificate thumbprint; no copied/expired fingerprint.
}

resource "aws_iam_role" "cni" {
  name = "${var.name}-eks-vpc-cni"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.this.arn }
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.this.url, "https://", "")}:sub" = "system:serviceaccount:kube-system:aws-node"
          "${replace(aws_iam_openid_connect_provider.this.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cni" {
  role       = aws_iam_role.cni.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKS_CNI_Policy"
}

# Query versions compatible with the selected control plane during a real plan.
data "aws_eks_addon_version" "this" {
  for_each           = toset(["vpc-cni", "kube-proxy", "coredns"])
  addon_name         = each.key
  kubernetes_version = var.kubernetes_version
  most_recent        = true
}

resource "aws_eks_addon" "cni" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "vpc-cni"
  addon_version               = data.aws_eks_addon_version.this["vpc-cni"].version
  service_account_role_arn    = aws_iam_role.cni.arn
  resolve_conflicts_on_create = "NONE"
  resolve_conflicts_on_update = "PRESERVE"
  depends_on                  = [aws_iam_role_policy_attachment.cni]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "kube-proxy"
  addon_version               = data.aws_eks_addon_version.this["kube-proxy"].version
  resolve_conflicts_on_create = "NONE"
  resolve_conflicts_on_update = "PRESERVE"
}

resource "aws_launch_template" "nodes" {
  for_each               = var.node_groups
  name_prefix            = "${var.name}-${each.key}-"
  update_default_version = true
  vpc_security_group_ids = [aws_security_group.nodes.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type           = "gp3"
      volume_size           = each.value.disk_size
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.name}-${each.key}" }
  }
}

resource "aws_eks_node_group" "this" {
  for_each        = var.node_groups
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = var.private_subnet_ids
  version         = aws_eks_cluster.this.version
  ami_type        = "AL2023_x86_64_STANDARD"
  instance_types  = each.value.instance_types
  capacity_type   = each.value.capacity_type

  launch_template {
    id      = aws_launch_template.nodes[each.key].id
    version = aws_launch_template.nodes[each.key].latest_version
  }
  scaling_config {
    min_size     = each.value.min_size
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
  }
  update_config {
    max_unavailable = 1
  }
  depends_on = [
    aws_iam_role_policy_attachment.nodes,
    aws_eks_addon.cni,
    aws_eks_addon.kube_proxy,
    aws_vpc_security_group_ingress_rule.control_plane_api,
    aws_vpc_security_group_ingress_rule.nodes_self,
    aws_vpc_security_group_ingress_rule.control_plane_to_nodes,
    aws_vpc_security_group_ingress_rule.control_plane_dns,
    aws_vpc_security_group_egress_rule.nodes_https,
    aws_vpc_security_group_egress_rule.nodes_dns,
    aws_vpc_security_group_egress_rule.nodes_self,
    aws_vpc_security_group_egress_rule.control_plane_to_nodes,
    aws_vpc_security_group_egress_rule.control_plane_dns,
  ]
}

# CoreDNS needs schedulable nodes; installing it before workers can time out.
resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.this.name
  addon_name                  = "coredns"
  addon_version               = data.aws_eks_addon_version.this["coredns"].version
  resolve_conflicts_on_create = "NONE"
  resolve_conflicts_on_update = "PRESERVE"
  depends_on                  = [aws_eks_node_group.this]
}
