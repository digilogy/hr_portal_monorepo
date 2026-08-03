# =============================================================================
# Core
# =============================================================================
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "ses_region" {
  description = "Region where SES identities are verified (matches email.service.ts's default)"
  type        = string
  default     = "ap-south-2"
}

variable "project" {
  type    = string
  default = "hr-portal"
}

variable "environment" {
  type    = string
  default = "prod"
}

# =============================================================================
# DNS / TLS
# =============================================================================
variable "root_domain" {
  description = "Route 53 hosted zone name"
  type        = string
}

variable "api_domain" {
  description = "Host for the API, e.g. api.hr.example.com"
  type        = string
}

variable "frontend_domain" {
  description = "Host for the static frontend, e.g. hr.example.com"
  type        = string
}

variable "jenkins_domain" {
  type = string
}

# =============================================================================
# Networking
# =============================================================================
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
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
  description = "Globally-unique uploads bucket name"
  type        = string
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

variable "rds_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "rds_multi_az" {
  type    = bool
  default = false
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "redis_num_nodes" {
  type    = number
  default = 1
}

# =============================================================================
# Jenkins / Ops
# =============================================================================
variable "jenkins_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "jenkins_admin_cidrs" {
  description = "CIDRs allowed to reach Jenkins SSH/UI — RESTRICT THIS to your office/VPN IPs"
  type        = list(string)
}

variable "jenkins_key_name" {
  description = "Existing EC2 key pair for SSH (null = SSM Session Manager only)"
  type        = string
  default     = null
}

variable "alarm_email" {
  description = "Email subscribed to CloudWatch alarm notifications"
  type        = string
}

variable "letsencrypt_email" {
  description = "Email for the Jenkins host Let's Encrypt certificate"
  type        = string
}
