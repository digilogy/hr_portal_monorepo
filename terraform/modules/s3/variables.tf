variable "bucket_name" {
  description = "Globally-unique bucket name for employee bulk-upload files"
  type        = string
}

variable "cors_allowed_origins" {
  description = "Origins allowed to use presigned upload URLs (frontend origins)"
  type        = list(string)
}

variable "tags" {
  type    = map(string)
  default = {}
}
