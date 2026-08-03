variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "api_port" {
  type    = number
  default = 5111
}

variable "jenkins_admin_cidrs" {
  description = "CIDRs allowed to reach Jenkins SSH (22) and UI (80/443)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
