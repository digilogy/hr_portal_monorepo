variable "name_prefix" {
  type = string
}

variable "repositories" {
  description = "Service names to create ECR repositories for"
  type        = list(string)
  default     = ["api", "mail-worker"]
}

variable "max_image_count" {
  description = "How many tagged images to retain per repository"
  type        = number
  default     = 20
}

variable "tags" {
  type    = map(string)
  default = {}
}
