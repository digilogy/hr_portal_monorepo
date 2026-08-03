variable "name_prefix" {
  type = string
}

variable "domain" {
  description = "Apex/subdomain served by CloudFront, e.g. hr.example.com"
  type        = string
}

variable "bucket_name" {
  description = "S3 bucket that holds the frontend static export"
  type        = string
}

variable "route53_zone_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
