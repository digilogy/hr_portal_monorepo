variable "name_prefix" {
  type = string
}

variable "subnet_ids" {
  description = "Private data subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  type = list(string)
}

variable "engine_version" {
  type    = string
  default = "16.8"
}

variable "serverless_min_capacity" {
  description = "Minimum Aurora capacity units (0.5 ACU is lowest possible)"
  type        = number
  default     = 0.5
}

variable "serverless_max_capacity" {
  description = "Maximum Aurora capacity units"
  type        = number
  default     = 4.0
}

variable "cluster_instances_count" {
  description = "Number of cluster instances to deploy across private data subnets"
  type        = number
  default     = 1
}

variable "db_name" {
  type    = string
  default = "timesheet"
}

variable "db_username" {
  type    = string
  default = "hr_user"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
