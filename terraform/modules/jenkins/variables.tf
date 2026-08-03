variable "name_prefix" {
  type = string
}

variable "subnet_id" {
  description = "Public subnet for the Jenkins instance"
  type        = string
}

variable "security_group_ids" {
  type = list(string)
}

variable "instance_profile_name" {
  type = string
}

variable "instance_type" {
  description = "t3.medium is enough for Docker builds of 2 Node images (api, mail-worker share one image)"
  type        = string
  default     = "t3.medium"
}

variable "root_volume_gb" {
  type    = number
  default = 40
}

variable "key_name" {
  description = "Existing EC2 key pair name for SSH (null = SSM Session Manager only)"
  type        = string
  default     = null
}

variable "jenkins_domain" {
  description = "FQDN for the Jenkins UI"
  type        = string
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate registration"
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
