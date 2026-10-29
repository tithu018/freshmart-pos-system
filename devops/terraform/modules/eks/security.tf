locals {
  # Kubelet, HTTPS webhooks, the future ALB-controller webhook and DNS.
  control_plane_tcp_ports = { https = 443, kubelet = 10250, webhook = 9443, dns = 53 }
}

resource "aws_security_group" "control_plane" {
  name_prefix = "${var.name}-control-plane-"
  description = "EKS API reachable from workers; EKS also owns its primary cluster group"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-control-plane" }
}

resource "aws_security_group" "nodes" {
  name_prefix = "${var.name}-nodes-"
  description = "Private EKS workers and VPC CNI pod addresses; no SSH ingress"
  vpc_id      = var.vpc_id
  tags = {
    Name                                = "${var.name}-nodes"
    "kubernetes.io/cluster/${var.name}" = "owned"
  }
}

resource "aws_vpc_security_group_ingress_rule" "control_plane_api" {
  security_group_id            = aws_security_group.control_plane.id
  referenced_security_group_id = aws_security_group.nodes.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
  description                  = "Workers to the private Kubernetes API"
}

resource "aws_vpc_security_group_ingress_rule" "nodes_self" {
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "-1"
  description                  = "Node/pod mesh inside this cluster; namespace policies belong to deployment"
}

resource "aws_vpc_security_group_ingress_rule" "private_api_clients" {
  for_each          = var.private_access_cidrs
  security_group_id = aws_security_group.control_plane.id
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "Explicitly approved private Kubernetes administration network"
}

resource "aws_vpc_security_group_egress_rule" "nodes_self" {
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.nodes.id
  ip_protocol                  = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "control_plane_to_nodes" {
  for_each                     = local.control_plane_tcp_ports
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.control_plane.id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
  description                  = "Control plane ${each.key}"
}

resource "aws_vpc_security_group_egress_rule" "control_plane_to_nodes" {
  for_each                     = local.control_plane_tcp_ports
  security_group_id            = aws_security_group.control_plane.id
  referenced_security_group_id = aws_security_group.nodes.id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "control_plane_dns" {
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.control_plane.id
  from_port                    = 53
  to_port                      = 53
  ip_protocol                  = "udp"
}

resource "aws_vpc_security_group_egress_rule" "control_plane_dns" {
  security_group_id            = aws_security_group.control_plane.id
  referenced_security_group_id = aws_security_group.nodes.id
  from_port                    = 53
  to_port                      = 53
  ip_protocol                  = "udp"
}

resource "aws_vpc_security_group_egress_rule" "nodes_https" {
  security_group_id = aws_security_group.nodes.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "Private API, AWS APIs, STS and HTTPS image registries via NAT/S3 endpoint"
}

resource "aws_vpc_security_group_egress_rule" "nodes_dns" {
  for_each          = toset(["tcp", "udp"])
  security_group_id = aws_security_group.nodes.id
  cidr_ipv4         = var.vpc_cidr
  from_port         = 53
  to_port           = 53
  ip_protocol       = each.value
  description       = "DNS inside the VPC"
}

# Prepare the network only. No ALB, listener, certificate or controller is installed.
resource "aws_security_group" "alb" {
  name_prefix = "${var.name}-alb-"
  description = "Future HTTPS ALB; egress only to frontend pod port 8080"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each          = var.alb_ingress_cidrs
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.nodes.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "frontend_from_alb" {
  security_group_id            = aws_security_group.nodes.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}
