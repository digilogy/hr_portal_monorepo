variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "security_group_ids" {
  type = list(string)
}

variable "certificate_arn" {
  type = string
}

variable "api_port" {
  type    = number
  default = 5111
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

variable "deregistration_delay" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
