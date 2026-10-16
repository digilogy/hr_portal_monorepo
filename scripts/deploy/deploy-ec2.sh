#!/usr/bin/env bash
# =============================================================================
# Deploy backend microservices to EC2 instance via AWS Systems Manager (SSM)
#
# Usage: ./scripts/deploy/deploy-ec2.sh [image-tag]
# =============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-2}"
INSTANCE_ID="${INSTANCE_ID:-i-0deef73787347a8ef}"
IMAGE_TAG="${1:-latest}"

echo "==> Deploying backend on EC2 (${INSTANCE_ID}) via AWS Systems Manager..."

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "Deploying Timesheet Backend ${IMAGE_TAG}" \
  --parameters 'commands=[
    "set -e",
    "cd /opt/timesheet",
    "aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 119750096195.dkr.ecr.ap-south-2.amazonaws.com || true",
    "docker compose pull || true",
    "docker compose up -d"
  ]' \
  --region "${AWS_REGION}" \
  --query "Command.CommandId" \
  --output text)

echo "==> Sent SSM command ${COMMAND_ID}. Waiting for completion..."

# Wait for SSM command to finish
for i in {1..30}; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "${COMMAND_ID}" \
    --instance-id "${INSTANCE_ID}" \
    --region "${AWS_REGION}" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")

  if [[ "${STATUS}" == "Success" ]]; then
    echo "==> Deployment on EC2 succeeded!"
    aws ssm get-command-invocation \
      --command-id "${COMMAND_ID}" \
      --instance-id "${INSTANCE_ID}" \
      --region "${AWS_REGION}" \
      --query "StandardOutputContent" \
      --output text
    exit 0
  elif [[ "${STATUS}" =~ ^(Failed|Cancelled|TimedOut)$ ]]; then
    echo "::error::SSM command failed with status ${STATUS}"
    aws ssm get-command-invocation \
      --command-id "${COMMAND_ID}" \
      --instance-id "${INSTANCE_ID}" \
      --region "${AWS_REGION}" \
      --query "StandardErrorContent" \
      --output text
    exit 1
  fi
  sleep 3
done

echo "==> Timed out waiting for SSM command"
exit 1
