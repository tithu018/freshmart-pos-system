variable "name" {
  type = string
}
variable "vpc_cidr" {
  type = string
}
variable "availability_zones" {
  type = list(string)
  validation {
    condition     = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2
    error_message = "The network module needs two distinct Availability Zones."
  }
}
variable "nat_gateway_mode" {
  type = string
  validation {
    condition     = contains(["single", "per_az"], var.nat_gateway_mode)
    error_message = "NAT mode must be single or per_az."
  }
}
variable "aws_region" {
  type = string
}
