# Remote state: S3 + DynamoDB locking.
#
# The bucket and lock table must be created once, out of band, then
# backend.hcl written next to this file (see backend.hcl.example).
# Initialize with:
#
#   terraform init -backend-config=backend.hcl
#
terraform {
  backend "s3" {}
}
