variable "name_prefix" {
  description = "Resource name prefix, e.g. hr-portal-prod"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread subnets across"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (ALB, NAT, Jenkins)"
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets (ECS tasks)"
  type        = list(string)
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs for private data subnets (RDS, ElastiCache)"
  type        = list(string)
}

variable "nat_gateway_count" {
  description = "Number of NAT gateways (1 = cost-optimized, one per AZ = HA)"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
