output "vpc_id" {
  value = aws_vpc.this.id
}
output "public_subnet_ids" {
  value = [for az in var.availability_zones : aws_subnet.public[az].id]
}
output "private_subnet_ids" {
  value      = [for az in var.availability_zones : aws_subnet.private[az].id]
  depends_on = [aws_route.private_nat, aws_route_table_association.private]
}
output "database_subnet_ids" {
  value      = [for az in var.availability_zones : aws_subnet.database[az].id]
  depends_on = [aws_route_table_association.database]
}
output "nat_public_ips" {
  value = { for az, address in aws_eip.nat : az => address.public_ip }
}
