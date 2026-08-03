variable "name_prefix" {
  type = string
}

variable "region" {
  type = string
}

variable "alarm_email" {
  description = "Email address subscribed to the alarms SNS topic"
  type        = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "api_target_group_arn_suffix" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "all_service_names" {
  description = "All ECS service names (api, mail-worker) for CPU/memory alarms + dashboard"
  type        = list(string)
}

variable "rds_instance_id" {
  type = string
}

variable "redis_replication_group_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
