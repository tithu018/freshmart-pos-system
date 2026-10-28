mock_provider "aws" {
  override_during = plan
  source          = "./tests/mocks"
}
variables {
  name                    = "freshmart-test"
  vpc_id                  = "vpc-0123456789abcdef0"
  vpc_cidr                = "10.42.0.0/16"
  private_subnet_ids      = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  kubernetes_version      = "1.36"
  cluster_admin_role_arns = ["arn:aws:iam::123456789012:role/test-admin"]
  endpoint_public_access  = false
  public_access_cidrs     = []
  private_access_cidrs    = []
  alb_ingress_cidrs       = []
  node_groups = {
    general = { instance_types = ["t3.medium"], capacity_type = "ON_DEMAND", min_size = 1, desired_size = 2, max_size = 3, disk_size = 20 }
  }
}

run "private_cluster_and_limited_roles" {
  command = plan
  module { source = "./modules/eks" }
  assert {
    condition = (aws_eks_cluster.this.vpc_config[0].endpoint_private_access && !aws_eks_cluster.this.vpc_config[0].endpoint_public_access &&
    aws_eks_cluster.this.access_config[0].authentication_mode == "API" && !aws_eks_cluster.this.access_config[0].bootstrap_cluster_creator_admin_permissions)
    error_message = "EKS must default to private access and explicit administrator roles."
  }
  assert {
    condition     = toset(keys(aws_iam_role_policy_attachment.nodes)) == toset(["AmazonEKSWorkerNodePolicy", "AmazonEC2ContainerRegistryPullOnly"])
    error_message = "Worker IAM must not gain CNI or application secret/admin policies."
  }
  assert {
    condition     = jsondecode(aws_iam_role.cni.assume_role_policy).Statement[0].Condition.StringEquals["oidc.eks.ap-south-1.amazonaws.com/id/TEST:sub"] == "system:serviceaccount:kube-system:aws-node"
    error_message = "CNI web identity trust must be scoped to the aws-node service account."
  }
  assert {
    condition = alltrue([for template in aws_launch_template.nodes : template.metadata_options[0].http_tokens == "required" && template.metadata_options[0].http_put_response_hop_limit == 1 && one(template.block_device_mappings).ebs[0].encrypted]) && alltrue([
      for group in aws_eks_node_group.this : toset(group.subnet_ids) == toset(var.private_subnet_ids)
    ])
    error_message = "Managed workers require private subnets, encrypted volumes and IMDSv2 with hop limit 1."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.alb_https) == 0 && aws_vpc_security_group_egress_rule.alb_to_frontend.to_port == 8080
    error_message = "The prepared ALB group must stay closed until clients are selected, with only frontend egress."
  }
}

run "restricted_public_api_and_multiple_groups" {
  command = plan
  module { source = "./modules/eks" }
  variables {
    endpoint_public_access = true
    public_access_cidrs    = ["203.0.113.10/32"]
    private_access_cidrs   = ["10.80.0.0/24"]
    alb_ingress_cidrs      = ["203.0.113.0/24"]
    node_groups = {
      general = { instance_types = ["t3.medium"], capacity_type = "ON_DEMAND", min_size = 1, desired_size = 2, max_size = 3, disk_size = 20 }
      extra   = { instance_types = ["t3.large"], capacity_type = "SPOT", min_size = 1, desired_size = 1, max_size = 2, disk_size = 20 }
    }
  }
  assert {
    condition     = aws_eks_cluster.this.vpc_config[0].endpoint_private_access && toset(aws_eks_cluster.this.vpc_config[0].public_access_cidrs) == toset(["203.0.113.10/32"]) && length(aws_eks_node_group.this) == 2
    error_message = "Public API CIDRs must stay restricted and extra managed groups must be supported."
  }
}
