variable "name_prefix" {
  type = string
}

variable "database_url" {
  description = "Full MySQL connection string, for Prisma (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "MySQL password for TypeORM's discrete connection env vars"
  type        = string
  sensitive   = true
}

variable "parameters" {
  description = "Non-secret config values stored in SSM Parameter Store"
  type        = map(string)
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
