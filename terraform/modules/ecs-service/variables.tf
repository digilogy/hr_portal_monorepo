variable "name_prefix" {
  type = string
}

variable "service_name" {
  description = "Short service name: api, mail-worker"
  type        = string
}

variable "cluster_id" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "image" {
  description = "Full image URI including tag"
  type        = string
}

variable "cpu" {
  description = "Fargate task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "container_port" {
  description = "HTTP port; null for background services (mail-worker)"
  type        = number
  default     = null
}

variable "desired_count" {
  type    = number
  default = 2
}

variable "environment" {
  description = "Plaintext environment variables"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Env var name => Secrets Manager/SSM ARN (injected by ECS)"
  type        = map(string)
  default     = {}
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "subnet_ids" {
  description = "Private app subnets"
  type        = list(string)
}

variable "security_group_ids" {
  type = list(string)
}

variable "target_group_arn" {
  description = "Attach to this ALB target group (null for background services)"
  type        = string
  default     = null
}

variable "health_check_path" {
  type    = string
  default = "/api/health"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "region" {
  type = string
}

# ---- Auto scaling ----
variable "enable_autoscaling" {
  type    = bool
  default = false
}

variable "min_capacity" {
  type    = number
  default = 2
}

variable "max_capacity" {
  type    = number
  default = 10
}

variable "cpu_target_value" {
  description = "Target-tracking CPU utilization percentage"
  type        = number
  default     = 60
}

variable "requests_per_target" {
  description = "ALB requests/target target-tracking value (null disables)"
  type        = number
  default     = null
}

variable "alb_arn_suffix" {
  description = "Required when requests_per_target is set"
  type        = string
  default     = null
}

variable "target_group_arn_suffix" {
  description = "Required when requests_per_target is set"
  type        = string
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
