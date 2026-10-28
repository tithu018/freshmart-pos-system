variable "aws_region" {
  description = "AWS region. Change the two AZs together with this value."
  type        = string
  default     = "ap-south-1"
  validation {
    condition     = can(regex("^[a-z]{2}(-[a-z]+)+-[0-9]+$", var.aws_region))
    error_message = "Use an AWS region identifier, for example ap-south-1."
  }
}

variable "aws_account_id" {
  description = "Explicit target account; the provider rejects credentials for other accounts."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Provide the intended 12-digit AWS account ID."
  }
}

variable "project" {
  type        = string
  description = "Short resource prefix using lowercase letters and digits."
  default     = "freshmart"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,19}$", var.project))
    error_message = "Project must contain 2-20 lowercase letters/digits and start with a letter."
  }
}

variable "environment" {
  type        = string
  description = "Environment name used in resource names and tags."
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging or prod."
  }
}

variable "tags" {
  type        = map(string)
  description = "Additional non-secret tags."
  default     = {}
}

variable "availability_zones" {
  type        = list(string)
  description = "Exactly two different standard AZs available to your account in aws_region."
  default     = ["ap-south-1a", "ap-south-1b"]
  validation {
    condition = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2 && alltrue([
      for az in var.availability_zones : can(regex("^${var.aws_region}[a-z]$", az))
    ])
    error_message = "Choose two distinct AZs belonging to aws_region."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "Canonical /16 IPv4 VPC range, sized for pods and six derived subnets."
  default     = "10.42.0.0/16"
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr)) && try(split("/", var.vpc_cidr)[1] == "16" && cidrhost(var.vpc_cidr, 0) == split("/", var.vpc_cidr)[0], false)
    error_message = "Provide a canonical IPv4 /16, for example 10.42.0.0/16."
  }
}

variable "nat_gateway_mode" {
  type        = string
  description = "single saves hourly cost; per_az avoids a shared-AZ egress dependency."
  default     = "single"
  validation {
    condition     = contains(["single", "per_az"], var.nat_gateway_mode)
    error_message = "NAT mode must be single or per_az; private nodes require outbound connectivity."
  }
}

variable "eks_version" {
  type        = string
  description = "EKS minor version; verify standard support and regional availability before planning."
  default     = "1.36"
  validation {
    condition     = can(regex("^1\\.[0-9]{2}$", var.eks_version))
    error_message = "Use an EKS minor version such as 1.36."
  }
}

variable "cluster_admin_role_arns" {
  type        = set(string)
  description = "Existing IAM roles explicitly granted cluster administration. No implicit creator admin."
  validation {
    condition = length(var.cluster_admin_role_arns) > 0 && alltrue([
      for arn in var.cluster_admin_role_arns : can(regex("^arn:aws(-us-gov|-cn)?:iam::${var.aws_account_id}:role/.+$", arn))
    ])
    error_message = "Provide at least one existing IAM role ARN in the target account; not an STS session ARN."
  }
}

variable "eks_public_access" {
  type        = bool
  description = "Optional restricted public Kubernetes API. Private access remains enabled."
  default     = false
}

variable "eks_public_access_cidrs" {
  type        = list(string)
  description = "Administrator IPv4 ranges, required if the public API is enabled; no world-open range."
  default     = []
  validation {
    condition = (!var.eks_public_access || length(var.eks_public_access_cidrs) > 0) && alltrue([
      for cidr in var.eks_public_access_cidrs : can(cidrnetmask(cidr)) && try(tonumber(split("/", cidr)[1]) >= 8, false)
    ])
    error_message = "Public API access requires explicit IPv4 CIDRs of /8 or narrower; 0.0.0.0/0 is forbidden."
  }
}

variable "node_groups" {
  description = "Managed x86_64 AL2023 node groups. Desired size is managed by Terraform; no autoscaler is installed."
  type = map(object({
    instance_types = optional(list(string), ["t3.medium"])
    capacity_type  = optional(string, "ON_DEMAND")
    min_size       = optional(number, 1)
    desired_size   = optional(number, 2)
    max_size       = optional(number, 3)
    disk_size      = optional(number, 20)
  }))
  default = { general = {} }
  validation {
    condition = length(var.node_groups) > 0 && alltrue([
      for name, group in var.node_groups : can(regex("^[a-z][a-z0-9-]{0,19}$", name)) &&
      contains(["ON_DEMAND", "SPOT"], group.capacity_type) &&
      group.min_size >= 1 && group.min_size <= group.desired_size && group.desired_size <= group.max_size &&
      alltrue([for n in [group.min_size, group.desired_size, group.max_size, group.disk_size] : n == floor(n)]) &&
      group.disk_size >= 20 && length(group.instance_types) > 0 && length(group.instance_types) <= 20
    ])
    error_message = "Node groups need valid names/capacity, integer min <= desired <= max (min >= 1), disks >= 20 GiB and 1-20 x86_64 instance types."
  }
}

variable "eks_private_access_cidrs" {
  type        = set(string)
  description = "Trusted VPN/runner source CIDRs allowed to the private API. Network connectivity must already exist."
  default     = []
  validation {
    condition = alltrue([
      for cidr in var.eks_private_access_cidrs : can(cidrnetmask(cidr)) && try(tonumber(split("/", cidr)[1]) >= 8, false)
    ])
    error_message = "Private API clients must be explicit IPv4 CIDRs of /8 or narrower."
  }
}

variable "alb_ingress_cidrs" {
  type        = set(string)
  description = "Future ALB HTTPS clients. Empty by default; use approved client CIDRs or 0.0.0.0/0 for a public site."
  default     = []
  validation {
    condition     = alltrue([for cidr in var.alb_ingress_cidrs : can(cidrnetmask(cidr))])
    error_message = "ALB clients must be valid IPv4 CIDRs."
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class; the development default is not sized for production load."
  default     = "db.t4g.micro"
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.db_instance_class))
    error_message = "Use an RDS instance class, for example db.t4g.micro."
  }
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name, matching the existing application default."
  default     = "freshmart_pos"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.db_name)) && lower(var.db_name) != "rdsadmin"
    error_message = "Use a PostgreSQL database identifier; rdsadmin is reserved."
  }
}

variable "db_master_username" {
  type        = string
  description = "Provisioning account only. Create a separate least-privilege application login before deployment."
  default     = "freshmart_admin"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,15}$", var.db_master_username)) && !contains(["postgres", "rdsadmin", "admin", "root"], lower(var.db_master_username))
    error_message = "Use a non-reserved username of 1-16 letters, digits or underscores, starting with a letter."
  }
}

variable "db_multi_az" {
  type        = bool
  description = "Enable a paid standby for production availability; false is a development cost choice."
  default     = false
}

variable "db_allocated_storage" {
  type        = number
  description = "Initial gp3 storage in GiB."
  default     = 20
  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 65536 && var.db_allocated_storage == floor(var.db_allocated_storage)
    error_message = "RDS storage must be an integer from 20 to 65536 GiB."
  }
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Storage autoscaling cap; must allow at least 10 percent growth."
  default     = 100
  validation {
    condition     = var.db_max_allocated_storage >= ceil(var.db_allocated_storage * 1.1) && var.db_max_allocated_storage <= 65536 && var.db_max_allocated_storage == floor(var.db_max_allocated_storage)
    error_message = "Choose an integer autoscaling cap at least 10 percent above initial storage, up to 65536 GiB."
  }
}

variable "db_deletion_protection" {
  type        = bool
  description = "Database deletion protection. Leave enabled until an explicitly reviewed decommission."
  default     = true
}

variable "db_final_snapshot_identifier" {
  type        = string
  description = "Optional unique final snapshot name. Default is <project>-<environment>-final."
  default     = null
  validation {
    condition     = var.db_final_snapshot_identifier == null || try(can(regex("^[a-zA-Z][a-zA-Z0-9-]{0,254}$", var.db_final_snapshot_identifier)) && !endswith(var.db_final_snapshot_identifier, "-") && !strcontains(var.db_final_snapshot_identifier, "--"), false)
    error_message = "Use a valid RDS snapshot identifier, without consecutive or trailing hyphens."
  }
}
