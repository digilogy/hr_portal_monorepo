variable "name_prefix" {
  type = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the task execution role may read"
  type        = list(string)
}

variable "s3_bucket_arn" {
  description = "Uploads bucket ARN"
  type        = string
}

variable "ses_region" {
  type    = string
  default = "ap-south-1"
}

variable "ecr_repository_arns" {
  type = list(string)
}

variable "ops_bucket_arns" {
  description = "S3 bucket ARNs Jenkins may read/write (frontend deploy bucket etc.)"
  type        = list(string)
  default     = []
}

variable "cloudfront_distribution_arns" {
  description = "CloudFront distributions Jenkins may invalidate (frontend deploys)"
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
