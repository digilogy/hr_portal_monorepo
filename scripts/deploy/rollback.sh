#!/usr/bin/env bash
# =============================================================================
# Manual rollback: point a service back at its previous task definition
# revision (or an explicit revision) and wait for stability.
#
# Usage:
#   ./scripts/deploy/rollback.sh <service>              # previous revision
#   ./scripts/deploy/rollback.sh <service> <revision>   # specific revision
#   service: api | mail-worker
# =============================================================================
set -euo pipefail

SERVICE="${1:?Usage: rollback.sh <service> [revision]}"
REVISION="${2:-}"

AWS_REGION="${AWS_REGION:-ap-south-1}"
NAME_PREFIX="${NAME_PREFIX:-hr-portal-prod}"
CLUSTER="${CLUSTER:-${NAME_PREFIX}-cluster}"
ECS_SERVICE="${NAME_PREFIX}-${SERVICE}"
FAMILY="${NAME_PREFIX}-${SERVICE}"

CURRENT=$(aws ecs describe-services \
  --cluster "${CLUSTER}" --services "${ECS_SERVICE}" --region "${AWS_REGION}" \
  --query 'services[0].taskDefinition' --output text)
CURRENT_REV="${CURRENT##*:}"
echo "==> ${ECS_SERVICE} currently on revision ${CURRENT_REV}"

if [ -z "${REVISION}" ]; then
  # Find the most recent ACTIVE revision older than the current one
  REVISION=$(aws ecs list-task-definitions \
    --family-prefix "${FAMILY}" --status ACTIVE --sort DESC \
    --region "${AWS_REGION}" --query 'taskDefinitionArns' --output text \
    | tr '\t' '\n' | awk -F: -v cur="${CURRENT_REV}" '$NF < cur { print $NF; exit }')
  if [ -z "${REVISION}" ]; then
    echo "!!> No older ACTIVE revision found to roll back to" >&2
    exit 1
  fi
fi

TARGET="${FAMILY}:${REVISION}"
echo "==> Rolling ${ECS_SERVICE} back to ${TARGET}"

aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --task-definition "${TARGET}" \
  --region "${AWS_REGION}" \
  --query 'service.taskDefinition' --output text

echo "==> Waiting for ${ECS_SERVICE} to stabilize..."
aws ecs wait services-stable \
  --cluster "${CLUSTER}" --services "${ECS_SERVICE}" --region "${AWS_REGION}"

echo "==> Rollback complete: ${ECS_SERVICE} on ${TARGET}"
