#!/usr/bin/env bash
# =============================================================================
# One-time bootstrap: S3 bucket + DynamoDB table for Terraform remote state.
# Run BEFORE the first `terraform init` on a fresh AWS account.
#
# Usage: ./scripts/deploy/bootstrap-terraform-state.sh [region]
# =============================================================================
set -euo pipefail

REGION="${1:-ap-south-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="hr-portal-terraform-state-${ACCOUNT_ID}"
TABLE="hr-portal-terraform-locks"
BACKEND_HCL="$(dirname "$0")/../../terraform/envs/production/backend.hcl"

echo "==> Account: ${ACCOUNT_ID}  Region: ${REGION}"

# --- State bucket ---
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "==> State bucket ${BUCKET} already exists"
else
  echo "==> Creating state bucket ${BUCKET}"
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi

aws s3api put-bucket-versioning --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "${BUCKET}" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# --- Lock table ---
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> Lock table ${TABLE} already exists"
else
  echo "==> Creating lock table ${TABLE}"
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}"
  aws dynamodb wait table-exists --table-name "${TABLE}" --region "${REGION}"
fi

# --- Backend config ---
cat > "${BACKEND_HCL}" <<EOF
bucket         = "${BUCKET}"
key            = "production/terraform.tfstate"
region         = "${REGION}"
dynamodb_table = "${TABLE}"
encrypt        = true
EOF

echo "==> Wrote ${BACKEND_HCL}"
echo "==> Next: cd terraform/envs/production && terraform init -backend-config=backend.hcl"
