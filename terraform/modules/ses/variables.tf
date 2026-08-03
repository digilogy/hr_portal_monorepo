variable "domain" {
  description = "Domain to verify as an SES sending identity"
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone for automatic DKIM/MAIL FROM record creation"
  type        = string
}

variable "mail_from_subdomain" {
  description = "Custom MAIL FROM subdomain (improves deliverability)"
  type        = string
  default     = "mail"
}

variable "name_prefix" {
  type = string
}

variable "dmarc_report_email" {
  description = "Mailbox that receives DMARC aggregate reports"
  type        = string
}

variable "delivery_webhook_url" {
  description = "HTTPS endpoint that receives SES delivery events via SNS (empty disables tracking — no such route exists in main-zip yet)"
  type        = string
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}
