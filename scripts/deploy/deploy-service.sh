#!/usr/bin/env bash
# =============================================================================
# Deploy one ECS service to a new image tag:
#   1. Fetch current task definition
#   2. Register a new revision with the updated image
#   3. Update the service and wait for it to stabilize
# The ECS deployment circuit breaker rolls back automatically on failure;
# this script exits non-zero in that case so CI marks the build failed.
#
# Usage: ./scripts/deploy/deploy-service.sh <service> <image-tag>
#   service: api | mail-worker
# =============================================================================
set -euo pipefail

SERVICE="${1:?Usage: deploy-service.sh <service> <image-tag>}"
TAG="${2:?Usage: deploy-service.sh <service> <image-tag>}"

AWS_REGION="${AWS_REGION:-ap-south-1}"
NAME_PREFIX="${NAME_PREFIX:-hr-portal-prod}"
CLUSTER="${CLUSTER:-${NAME_PREFIX}-cluster}"
ECS_SERVICE="${NAME_PREFIX}-${SERVICE}"
FAMILY="${NAME_PREFIX}-${SERVICE}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${NAME_PREFIX}/${SERVICE}:${TAG}"

echo "==> Deploying ${ECS_SERVICE} with image ${IMAGE}"

# 1. Current task definition
CURRENT_TD=$(aws ecs describe-task-definition \
  --task-definition "${FAMILY}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition')

# 2. New revision with updated image (strip read-only fields)
NEW_TD=$(echo "${CURRENT_TD}" | python3 -c "
import json, sys
td = json.load(sys.stdin)
td['containerDefinitions'][0]['image'] = '${IMAGE}'
for k in ('taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(k, None)
json.dump(td, sys.stdout)
")

NEW_TD_ARN=$(aws ecs register-task-definition \
  --region "${AWS_REGION}" \
  --cli-input-json "${NEW_TD}" \
  --query 'taskDefinition.taskDefinitionArn' --output text)
echo "==> Registered ${NEW_TD_ARN}"

# 3. Update service and wait
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --task-definition "${NEW_TD_ARN}" \
  --region "${AWS_REGION}" \
  --query 'service.serviceName' --output text

echo "==> Waiting for ${ECS_SERVICE} to stabilize (circuit breaker will roll back on failure)..."
if ! aws ecs wait services-stable \
  --cluster "${CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --region "${AWS_REGION}"; then
  echo "!!> ${ECS_SERVICE} failed to stabilize" >&2
  exit 1
fi

# Confirm the service is actually running the new revision (i.e. it wasn't
# rolled back by the circuit breaker while we waited)
RUNNING_TD=$(aws ecs describe-services \
  --cluster "${CLUSTER}" --services "${ECS_SERVICE}" --region "${AWS_REGION}" \
  --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition | [0]' --output text)

if [ "${RUNNING_TD}" != "${NEW_TD_ARN}" ]; then
  echo "!!> Circuit breaker rolled ${ECS_SERVICE} back to ${RUNNING_TD}" >&2
  exit 1
fi

echo "==> ${ECS_SERVICE} deployed successfully on ${NEW_TD_ARN}"
