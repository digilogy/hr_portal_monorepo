#!/usr/bin/env bash
# =============================================================================
# Manual rollback for EC2 Docker microservices stack
#
# Usage:
#   ./scripts/deploy/rollback.sh [target-image-tag]
# =============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-2}"
INSTANCE_ID="${INSTANCE_ID:-i-0deef73787347a8ef}"
IMAGE_TAG="${1:-rollback-backup}"

echo "==> Rolling back EC2 stack (${INSTANCE_ID}) via AWS Systems Manager..."

ROLLBACK_PAYLOAD=$(cat <<EOF
{
  "commands": [
    "set -e",
    "cd /opt/timesheet",
    "echo '==> Restoring previous docker-compose configuration...'",
    "if [[ -f docker-compose.yml.bak ]]; then cp docker-compose.yml.bak docker-compose.yml; fi",
    "echo '==> Reverting container images...'",
    "docker tag timesheet-api:${IMAGE_TAG} timesheet-api:arm64 2>/dev/null || true",
    "docker tag timesheet-reports:${IMAGE_TAG} timesheet-reports:arm64 2>/dev/null || true",
    "docker tag timesheet-admin:${IMAGE_TAG} timesheet-admin:arm64 2>/dev/null || true",
    "docker tag timesheet-mail-worker:${IMAGE_TAG} timesheet-mail-worker:arm64 2>/dev/null || true",
    "echo '==> Restarting container stack with health checks...'",
    "docker compose up -d --wait --wait-timeout 60",
    "echo '==> Health check status:'",
    "docker compose ps"
  ]
}
EOF
)

PARAM_FILE=$(mktemp)
echo "${ROLLBACK_PAYLOAD}" > "${PARAM_FILE}"

if command -v cygpath >/dev/null 2>&1; then
  AWS_PARAM_FILE=$(cygpath -w "${PARAM_FILE}")
else
  AWS_PARAM_FILE="${PARAM_FILE}"
fi

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "Manual rollback of Timesheet Backend" \
  --parameters "file://${AWS_PARAM_FILE}" \
  --region "${AWS_REGION}" \
  --query "Command.CommandId" \
  --output text)

rm -f "${PARAM_FILE}"

echo "==> Sent rollback SSM command ${COMMAND_ID}. Waiting for completion..."

for i in {1..30}; do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "${COMMAND_ID}" \
    --instance-id "${INSTANCE_ID}" \
    --region "${AWS_REGION}" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")

  if [[ "${STATUS}" == "Success" ]]; then
    echo "==> Rollback succeeded!"
    aws ssm get-command-invocation \
      --command-id "${COMMAND_ID}" \
      --instance-id "${INSTANCE_ID}" \
      --region "${AWS_REGION}" \
      --query "StandardOutputContent" \
      --output text
    exit 0
  elif [[ "${STATUS}" =~ ^(Failed|Cancelled|TimedOut)$ ]]; then
    echo "::error::Rollback failed with status ${STATUS}"
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

echo "==> Timed out waiting for rollback command"
exit 1
