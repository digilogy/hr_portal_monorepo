variable "domain_name" {
  description = "Primary certificate domain, e.g. api.hr-portal.example.com"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domains on the same cert"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Hosted zone used for DNS validation"
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
