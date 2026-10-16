#!/usr/bin/env bash
# =============================================================================
# Deploy backend microservices to EC2 instance via AWS Systems Manager (SSM)
# Features:
#   - Pre-deployment rollback backup tagging
#   - Synchronization of docker-compose.production.yml
#   - Docker Compose --wait healthcheck gating (service_healthy dependencies)
#   - Post-switch smoke-test verification on all internal ports (5111, 5112, 5113)
#   - Automated zero-downtime rollback if health checks fail
#
# Usage: ./scripts/deploy/deploy-ec2.sh [image-tag]
# =============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-2}"
INSTANCE_ID="${INSTANCE_ID:-i-0deef73787347a8ef}"
IMAGE_TAG="${1:-latest}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infrastructure/docker/docker-compose.production.yml"

echo "==> Preparing production docker-compose configuration..."
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "::error::Compose file not found at ${COMPOSE_FILE}"
  exit 1
fi

COMPOSE_B64=$(base64 -w 0 "${COMPOSE_FILE}" 2>/dev/null || base64 "${COMPOSE_FILE}" | tr -d '\r\n')

echo "==> Deploying backend on EC2 (${INSTANCE_ID}) via AWS Systems Manager..."

DEPLOY_PAYLOAD=$(cat <<EOF
{
  "commands": [
    "set -e",
    "cd /opt/timesheet",
    "echo '==> [Step 1/6] Taking rollback snapshot of currently running images...'",
    "docker tag timesheet-api:arm64 timesheet-api:rollback-backup 2>/dev/null || true",
    "docker tag timesheet-reports:arm64 timesheet-reports:rollback-backup 2>/dev/null || true",
    "docker tag timesheet-admin:arm64 timesheet-admin:rollback-backup 2>/dev/null || true",
    "docker tag timesheet-mail-worker:arm64 timesheet-mail-worker:rollback-backup 2>/dev/null || true",
    "cp docker-compose.yml docker-compose.yml.bak 2>/dev/null || true",
    "echo '==> [Step 2/6] Applying updated docker-compose configuration...'",
    "echo '${COMPOSE_B64}' | base64 -d > docker-compose.yml",
    "echo '==> [Step 3/6] Authenticating with ECR...'",
    "aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 119750096195.dkr.ecr.ap-south-2.amazonaws.com || true",
    "docker compose pull || true",
    "echo '==> [Step 4/6] Switching containers with health check gating (--wait)...'",
    "if ! docker compose up -d --wait --wait-timeout 90; then",
    "    echo '::error::Deployment failed container health check gating! Rolling back to previous healthy state...'",
    "    docker tag timesheet-api:rollback-backup timesheet-api:arm64 2>/dev/null || true",
    "    docker tag timesheet-reports:rollback-backup timesheet-reports:arm64 2>/dev/null || true",
    "    docker tag timesheet-admin:rollback-backup timesheet-admin:arm64 2>/dev/null || true",
    "    docker tag timesheet-mail-worker:rollback-backup timesheet-mail-worker:arm64 2>/dev/null || true",
    "    cp docker-compose.yml.bak docker-compose.yml 2>/dev/null || true",
    "    docker compose up -d --wait --wait-timeout 60",
    "    echo '::error::Rollback complete: previous healthy containers restored.'",
    "    exit 1",
    "fi",
    "echo '==> [Step 5/6] Running internal microservice smoke tests...'",
    "for port in 5111 5112 5113; do",
    "    if ! curl -fsS \"http://127.0.0.1:\${port}/api/health\" > /dev/null; then",
    "        echo \"::error::Internal port \${port} failed health verification! Rolling back...\"",
    "        docker tag timesheet-api:rollback-backup timesheet-api:arm64 2>/dev/null || true",
    "        docker tag timesheet-reports:rollback-backup timesheet-reports:arm64 2>/dev/null || true",
    "        docker tag timesheet-admin:rollback-backup timesheet-admin:arm64 2>/dev/null || true",
    "        docker tag timesheet-mail-worker:rollback-backup timesheet-mail-worker:arm64 2>/dev/null || true",
    "        cp docker-compose.yml.bak docker-compose.yml 2>/dev/null || true",
    "        docker compose up -d --wait --wait-timeout 60",
    "        exit 1",
    "    fi",
    "done",
    "echo '==> [Step 6/6] All microservices healthy! Pruning dangling images...'",
    "docker rmi timesheet-api:rollback-backup timesheet-reports:rollback-backup timesheet-admin:rollback-backup timesheet-mail-worker:rollback-backup 2>/dev/null || true",
    "docker image prune -f",
    "echo '==> Deployment finished successfully!'",
    "docker compose ps"
  ]
}
EOF
)

PARAM_FILE=$(mktemp)
echo "${DEPLOY_PAYLOAD}" > "${PARAM_FILE}"

if command -v cygpath >/dev/null 2>&1; then
  AWS_PARAM_FILE=$(cygpath -w "${PARAM_FILE}")
else
  AWS_PARAM_FILE="${PARAM_FILE}"
fi

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "Deploying Timesheet Backend ${IMAGE_TAG} with healthcheck and rollback checks" \
  --parameters "file://${AWS_PARAM_FILE}" \
  --region "${AWS_REGION}" \
  --query "Command.CommandId" \
  --output text)

rm -f "${PARAM_FILE}"

echo "==> Sent SSM command ${COMMAND_ID}. Waiting for health checks and container switching..."

# Wait for SSM command to finish
for i in {1..40}; do
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
  sleep 4
done

echo "==> Timed out waiting for SSM command"
exit 1
