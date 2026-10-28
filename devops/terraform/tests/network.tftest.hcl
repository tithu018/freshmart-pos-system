mock_provider "aws" {
  override_during = plan
  source          = "./tests/mocks"
  mock_resource "aws_nat_gateway" {
    defaults = { id = "nat-0123456789abcdef0" }
  }
  mock_resource "aws_route_table" {
    defaults = { id = "rtb-0123456789abcdef0" }
  }
}

variables {
  name               = "freshmart-test"
  vpc_cidr           = "10.42.0.0/16"
  availability_zones = ["ap-south-1a", "ap-south-1b"]
  aws_region         = "ap-south-1"
  nat_gateway_mode   = "single"
}

run "single_nat_and_isolated_database" {
  command = plan
  module { source = "./modules/network" }
  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2 && length(aws_subnet.database) == 2
    error_message = "Each of the three subnet tiers must span both AZs."
  }
  assert {
    condition     = length(aws_nat_gateway.this) == 1 && length(aws_eip.nat) == 1
    error_message = "The cost-saving mode must allocate only one NAT and EIP."
  }
  assert {
    condition     = alltrue([for route in aws_route.private_nat : route.nat_gateway_id == aws_nat_gateway.this["ap-south-1a"].id])
    error_message = "Both private routes must use the single NAT."
  }
  assert {
    condition = alltrue([for subnet in concat(values(aws_subnet.private), values(aws_subnet.database)) : !subnet.map_public_ip_on_launch]) && alltrue([
      for association in aws_route_table_association.database : association.route_table_id == aws_route_table.database.id
    ]) && length(aws_route_table.database.route) == 0
    error_message = "Workers/RDS must not auto-assign public IPs; RDS must use the isolated route table."
  }
  assert {
    condition = toset(concat(
      [for s in aws_subnet.public : s.cidr_block],
      [for s in aws_subnet.private : s.cidr_block],
      [for s in aws_subnet.database : s.cidr_block]
    )) == toset(["10.42.0.0/24", "10.42.1.0/24", "10.42.16.0/20", "10.42.32.0/20", "10.42.240.0/24", "10.42.241.0/24"])
    error_message = "Derived subnet ranges must remain separate and inside the VPC."
  }
  assert {
    condition = alltrue([for s in aws_subnet.public : s.tags["kubernetes.io/role/elb"] == "1"]) && alltrue([
      for s in aws_subnet.private : s.tags["kubernetes.io/role/internal-elb"] == "1"
    ]) && alltrue([for s in aws_subnet.database : !contains(keys(s.tags), "kubernetes.io/role/elb") && !contains(keys(s.tags), "kubernetes.io/role/internal-elb")])
    error_message = "Load-balancer discovery must use the intended subnet tiers only."
  }
}

run "per_az_nat_routing" {
  command = plan
  module { source = "./modules/network" }
  variables { nat_gateway_mode = "per_az" }
  override_resource {
    target          = aws_nat_gateway.this["ap-south-1b"]
    override_during = plan
    values          = { id = "nat-0123456789abcdef1" }
  }
  assert {
    condition     = length(aws_nat_gateway.this) == 2 && alltrue([for az, route in aws_route.private_nat : route.nat_gateway_id == aws_nat_gateway.this[az].id])
    error_message = "Each private subnet must use the NAT in its own AZ in per_az mode."
  }
}
