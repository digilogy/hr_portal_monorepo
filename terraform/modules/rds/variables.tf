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
  default = "8.0"
}

variable "instance_class" {
  description = "db.t3.medium is a sane baseline for HR-portal-scale traffic; size up if load testing shows otherwise"
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling (GB)"
  type        = number
  default     = 100
}

variable "db_name" {
  type    = string
  default = "hr-portal"
}

variable "db_username" {
  type    = string
  default = "hr_user"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "multi_az" {
  type    = bool
  default = false
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
