# =============================================================================
# Core
# =============================================================================
variable "aws_region" {
  type    = string
  default = "ap-south-2"
}

variable "ses_region" {
  description = "Region where SES identities are verified (matches email.service.ts's default)"
  type        = string
  default     = "ap-south-2"
}

variable "project" {
  type        = string
  default     = "timesheet"
  description = "Project name identifier"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "custom_name_prefix" {
  description = "Dynamic naming prefix for all AWS resources in this project. Defaults to 'timesheet'."
  type        = string
  default     = "timesheet"
}

# =============================================================================
# DNS / TLS
# =============================================================================
variable "root_domain" {
  description = "Route 53 hosted zone name"
  type        = string
  default     = "cgworkflow.com"
}

variable "api_domain" {
  description = "Host for the API"
  type        = string
  default     = "api.timesheet.cgworkflow.com"
}

variable "frontend_domain" {
  description = "Host for the static frontend"
  type        = string
  default     = "timesheet.cgworkflow.com"
}

variable "wildcard_domain" {
  description = "Wildcard domain SAN for SSL certificates"
  type        = string
  default     = "*.timesheet.cgworkflow.com"
}

variable "jenkins_domain" {
  type        = string
  default     = ""
  description = "Deprecated: Jenkins is replaced by GitHub Actions"
}

# =============================================================================
# Networking & Existing VPC
# =============================================================================
variable "use_existing_vpc" {
  description = "Set to true to deploy into an existing VPC (e.g. cgworkflow-vpc)"
  type        = bool
  default     = true
}

variable "existing_vpc_id" {
  description = "Existing VPC ID to use when use_existing_vpc is true"
  type        = string
  default     = "vpc-008b8b114c2a60384"
}

variable "existing_public_subnet_ids" {
  description = "Existing public subnet IDs (for ALB and public ingress)"
  type        = list(string)
  default     = ["subnet-07619bc3f48623572", "subnet-0af9ab23506156e0e"]
}

variable "existing_private_app_subnet_ids" {
  description = "Existing private subnet IDs for ECS application tasks"
  type        = list(string)
  default     = ["subnet-06484ac6dbc345dc3", "subnet-0fab456e74f07ab12"]
}

variable "existing_private_data_subnet_ids" {
  description = "Existing private subnet IDs for RDS Aurora"
  type        = list(string)
  default     = ["subnet-06484ac6dbc345dc3", "subnet-0fab456e74f07ab12"]
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["ap-south-2a", "ap-south-2b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/20", "10.0.16.0/20"]
}

variable "private_app_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.32.0/20", "10.0.48.0/20"]
}

variable "private_data_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.64.0/24", "10.0.65.0/24"]
}

variable "nat_gateway_count" {
  description = "1 = cost-optimized; 2 = AZ-redundant NAT"
  type        = number
  default     = 1
}

# =============================================================================
# Redis Reuse / Serverless
# =============================================================================
variable "create_redis" {
  description = "Whether to create a new ElastiCache Serverless Redis or reuse an existing one"
  type        = bool
  default     = false
}

variable "existing_redis_host" {
  description = "Host endpoint of existing Serverless Redis"
  type        = string
  default     = "cgworkflow-redis-cifm8b.serverless.aps2.cache.amazonaws.com"
}

variable "existing_redis_port" {
  description = "Port of existing Serverless Redis"
  type        = number
  default     = 6379
}

variable "existing_redis_sg_id" {
  description = "Security Group ID of the existing Serverless Redis to allow ingress from Timesheet app tasks"
  type        = string
  default     = "sg-01992f7027b8eef20"
}

variable "existing_redis_cache_name" {
  description = "Cache name of the existing Serverless Redis for CloudWatch monitoring"
  type        = string
  default     = "cgworkflow-redis"
}

# =============================================================================
# Application
# =============================================================================
variable "allowed_origins" {
  description = "Frontend origin(s) allowed by API CORS (comma-separated, read as ALLOWED_ORIGINS)"
  type        = string
}

variable "ses_from_email" {
  description = "Verified SES sender address"
  type        = string
}

variable "admin_user" {
  description = "Admin login email"
  type        = string
  sensitive   = true
}

variable "admin_pin" {
  description = "Admin login PIN"
  type        = string
  sensitive   = true
}

variable "s3_bucket_name" {
  description = "Globally-unique uploads bucket name (optional: auto-generated as <name_prefix>-uploads-<account_id> if left empty)"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Initial image tag for first deployment (CI manages tags afterwards)"
  type        = string
  default     = "latest"
}

variable "prisma_connection_limit" {
  description = "Prisma pool size per task (migration connections only — TypeORM manages its own runtime pool)"
  type        = number
  default     = 5
}

# =============================================================================
# Sizing — HR-portal scale is far lower than a public idea-submission portal;
# defaults here are deliberately conservative compared to the reference.
# =============================================================================
variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_min_tasks" {
  type    = number
  default = 2
}

variable "api_max_tasks" {
  type    = number
  default = 6
}

variable "api_requests_per_target" {
  description = "ALB requests/target scaling target (null disables request-based scaling)"
  type        = number
  default     = null
}

variable "mail_worker_desired_count" {
  type    = number
  default = 1
}

variable "aurora_min_capacity" {
  description = "Minimum Aurora Serverless v2 capacity units (0.5 ACU min)"
  type        = number
  default     = 0.5
}

variable "aurora_max_capacity" {
  description = "Maximum Aurora Serverless v2 capacity units"
  type        = number
  default     = 4.0
}

variable "aurora_instances_count" {
  description = "Number of Aurora Serverless v2 reader/writer instances"
  type        = number
  default     = 1
}

variable "redis_max_data_storage_gb" {
  description = "Maximum storage limit in GB for ElastiCache Serverless Redis"
  type        = number
  default     = 5
}

variable "redis_max_ecpu_per_second" {
  description = "Maximum ECPU per second for ElastiCache Serverless Redis"
  type        = number
  default     = 5000
}

# =============================================================================
# Ops
# =============================================================================
variable "jenkins_admin_cidrs" {
  description = "CIDRs allowed (deprecated)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "alarm_email" {
  description = "Email subscribed to CloudWatch alarm notifications"
  type        = string
  default     = "ops@cgworkflow.com"
}
