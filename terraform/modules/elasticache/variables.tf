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

variable "max_data_storage_gb" {
  description = "Maximum storage limit in GB for serverless redis"
  type        = number
  default     = 5
}

variable "max_ecpu_per_second" {
  description = "Maximum ECPU per second for serverless redis"
  type        = number
  default     = 5000
}

variable "tags" {
  type    = map(string)
  default = {}
}
