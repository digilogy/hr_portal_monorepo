#!/usr/bin/env bash
# =============================================================================
# Run Prisma migrations as a one-off Fargate task using the API image,
# BEFORE rolling out new application code.
#
# Unlike ideas-staging-backend's `prisma db push --accept-data-loss` (no
# tracked migrations, schema pushed directly), main-zip has real tracked
# Prisma migrations as of Stage 0/4 — this uses the safer `migrate deploy`,
# which only applies pending migration files and never drops data.
#
# Usage: ./scripts/deploy/run-migrations.sh [image-tag]
#   image-tag defaults to the current api task definition's image
# =============================================================================
set -euo pipefail

TAG="${1:-}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
NAME_PREFIX="${NAME_PREFIX:-hr-portal-prod}"
CLUSTER="${CLUSTER:-${NAME_PREFIX}-cluster}"
FAMILY="${NAME_PREFIX}-api"

# Discover networking from the running api service
read -r SUBNETS SGS <<< "$(aws ecs describe-services \
  --cluster "${CLUSTER}" --services "${NAME_PREFIX}-api" --region "${AWS_REGION}" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.[join(`,`,subnets),join(`,`,securityGroups)]' \
  --output text)"

OVERRIDES='{"containerOverrides":[{"name":"api","command":["sh","-c","cd packages/database && npx prisma migrate deploy"]}]}'

if [ -n "${TAG}" ]; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${NAME_PREFIX}/api:${TAG}"
  # Register a throwaway revision pinned to the new image so the migration
  # matches the code about to be deployed
  CURRENT_TD=$(aws ecs describe-task-definition --task-definition "${FAMILY}" \
    --region "${AWS_REGION}" --query 'taskDefinition')
  NEW_TD=$(echo "${CURRENT_TD}" | python3 -c "
import json, sys
td = json.load(sys.stdin)
td['containerDefinitions'][0]['image'] = '${IMAGE}'
for k in ('taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(k, None)
json.dump(td, sys.stdout)
")
  TD_ARN=$(aws ecs register-task-definition --region "${AWS_REGION}" \
    --cli-input-json "${NEW_TD}" \
    --query 'taskDefinition.taskDefinitionArn' --output text)
else
  TD_ARN="${FAMILY}"
fi

echo "==> Running migration task (${TD_ARN})"
TASK_ARN=$(aws ecs run-task \
  --cluster "${CLUSTER}" \
  --task-definition "${TD_ARN}" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SGS}],assignPublicIp=DISABLED}" \
  --overrides "${OVERRIDES}" \
  --region "${AWS_REGION}" \
  --query 'tasks[0].taskArn' --output text)

echo "==> Migration task: ${TASK_ARN}"
aws ecs wait tasks-stopped --cluster "${CLUSTER}" --tasks "${TASK_ARN}" --region "${AWS_REGION}"

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "${CLUSTER}" --tasks "${TASK_ARN}" --region "${AWS_REGION}" \
  --query 'tasks[0].containers[0].exitCode' --output text)

if [ "${EXIT_CODE}" != "0" ]; then
  echo "!!> Migration task exited with code ${EXIT_CODE}. Logs:" >&2
  TASK_ID="${TASK_ARN##*/}"
  aws logs get-log-events \
    --log-group-name "/ecs/${FAMILY}" \
    --log-stream-name "api/api/${TASK_ID}" \
    --region "${AWS_REGION}" \
    --query 'events[*].message' --output text 2>/dev/null | tail -50 || true
  exit 1
fi

echo "==> Migrations applied successfully"
