variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "database_subnet_ids" {
  type = list(string)
}
variable "node_security_group_id" {
  type = string
}
variable "db_name" {
  type = string
}
variable "master_username" {
  type = string
}
variable "instance_class" {
  type = string
}
variable "multi_az" {
  type = bool
}
variable "allocated_storage" {
  type = number
}
variable "max_allocated_storage" {
  type = number
}
variable "deletion_protection" {
  type = bool
}
variable "final_snapshot_identifier" {
  type = string
}
