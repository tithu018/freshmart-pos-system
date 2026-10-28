variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "vpc_cidr" {
  type = string
}
variable "private_subnet_ids" {
  type = list(string)
}
variable "kubernetes_version" {
  type = string
}
variable "cluster_admin_role_arns" {
  type = set(string)
}
variable "endpoint_public_access" {
  type = bool
}
variable "public_access_cidrs" {
  type = list(string)
}
variable "private_access_cidrs" {
  type = set(string)
}
variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    capacity_type  = string
    min_size       = number
    desired_size   = number
    max_size       = number
    disk_size      = number
  }))
}
variable "alb_ingress_cidrs" {
  type = set(string)
}
