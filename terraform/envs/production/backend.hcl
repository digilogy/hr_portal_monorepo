# Copy to backend.hcl and fill in your AWS account ID.
bucket         = "timesheet-terraform-state-119750096195"
key            = "production/terraform.tfstate"
region         = "ap-south-2"
dynamodb_table = "timesheet-terraform-locks"
encrypt        = true
