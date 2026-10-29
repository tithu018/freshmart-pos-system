locals {
  zones     = { for index, az in var.availability_zones : az => index }
  nat_zones = var.nat_gateway_mode == "single" ? { (var.availability_zones[0]) = 0 } : local.zones
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

# Remove the VPC default group's permissive self/egress rules. All resources
# below use explicit security groups instead.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-unused-default" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = var.name }
}

resource "aws_subnet" "public" {
  for_each                = local.zones
  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, each.value)
  map_public_ip_on_launch = false
  tags = {
    Name                                = "${var.name}-public-${each.key}"
    "kubernetes.io/role/elb"            = "1"
    "kubernetes.io/cluster/${var.name}" = "shared"
  }
}

resource "aws_subnet" "private" {
  for_each                = local.zones
  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, each.value + 1)
  map_public_ip_on_launch = false
  tags = {
    Name                                = "${var.name}-nodes-${each.key}"
    "kubernetes.io/role/internal-elb"   = "1"
    "kubernetes.io/cluster/${var.name}" = "shared"
  }
}

resource "aws_subnet" "database" {
  for_each                = local.zones
  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 240 + each.value)
  map_public_ip_on_launch = false
  # Deliberately not tagged for load-balancer discovery.
  tags = { Name = "${var.name}-database-${each.key}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-public" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each       = local.zones
  subnet_id      = aws_subnet.public[each.key].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  for_each = local.nat_zones
  domain   = "vpc"
  tags     = { Name = "${var.name}-nat-${each.key}" }
}

resource "aws_nat_gateway" "this" {
  for_each      = local.nat_zones
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id
  tags          = { Name = "${var.name}-${each.key}" }
  depends_on    = [aws_internet_gateway.this, aws_route.public_internet, aws_route_table_association.public]
}

resource "aws_route_table" "private" {
  for_each = local.zones
  vpc_id   = aws_vpc.this.id
  tags     = { Name = "${var.name}-nodes-${each.key}" }
}

resource "aws_route" "private_nat" {
  for_each               = local.zones
  route_table_id         = aws_route_table.private[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[var.nat_gateway_mode == "single" ? var.availability_zones[0] : each.key].id
}

resource "aws_route_table_association" "private" {
  for_each       = local.zones
  subnet_id      = aws_subnet.private[each.key].id
  route_table_id = aws_route_table.private[each.key].id
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.this.id
  # Only the implicit VPC-local route: no NAT or Internet Gateway route.
  route = []
  tags  = { Name = "${var.name}-database-isolated" }
}

resource "aws_route_table_association" "database" {
  for_each       = local.zones
  subnet_id      = aws_subnet.database[each.key].id
  route_table_id = aws_route_table.database.id
}

# Gateway endpoints have no hourly charge and avoid NAT processing for S3,
# including ECR image layer downloads. This is not an interface endpoint.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [for az in var.availability_zones : aws_route_table.private[az].id]
  tags              = { Name = "${var.name}-s3" }
}
