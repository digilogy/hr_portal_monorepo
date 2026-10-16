#!/usr/bin/env bash
# =============================================================================
# Automated Setup: AWS ElastiCache Serverless Redis for Timesheet Portal
# Run this directly in AWS CloudShell (in region ap-south-2) or via CI/CD.
#
# It will:
#   1. Create (or discover) the Serverless Redis cache in VPC subnets.
#   2. Wait until it is Available and obtain the primary endpoint.
#   3. Update timesheet-api & timesheet-mail-worker ECS Task Definitions.
#   4. Trigger an in-place rolling update of the ECS services.
# =============================================================================
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-2}"
CLUSTER="timesheet-cluster"
CACHE_NAME="timesheet-redis"
SUBNET_IDS=("subnet-06484ac6dbc345dc3" "subnet-0fab456e74f07ab12")
SECURITY_GROUP_IDS=("sg-01992f7027b8eef20")

echo "=========================================================="
echo " AWS ElastiCache Serverless Setup: ${CACHE_NAME}"
echo " Region: ${AWS_REGION} | Cluster: ${CLUSTER}"
echo "=========================================================="

# 1. Check if serverless cache already exists
echo "==> [1/4] Checking ElastiCache Serverless Cache '${CACHE_NAME}'..."
CACHE_STATUS=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "${CACHE_NAME}" \
  --region "${AWS_REGION}" \
  --query 'ServerlessCaches[0].Status' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "${CACHE_STATUS}" = "NOT_FOUND" ]; then
  echo "==> Cache not found. Creating new Serverless Redis cache: ${CACHE_NAME}..."
  aws elasticache create-serverless-cache \
    --serverless-cache-name "${CACHE_NAME}" \
    --engine redis \
    --subnet-ids "${SUBNET_IDS[@]}" \
    --security-group-ids "${SECURITY_GROUP_IDS[@]}" \
    --daily-snapshot-time "19:30" \
    --snapshot-retention-limit 1 \
    --description "Serverless Redis for Timesheet HR Portal BullMQ and Session Cache" \
    --region "${AWS_REGION}" >/dev/null
  echo "==> Creation initiated successfully."
else
  echo "==> Found existing cache '${CACHE_NAME}' with status: ${CACHE_STATUS}"
fi

# 2. Wait for Cache to become Available
echo "==> [2/4] Waiting for ${CACHE_NAME} to become 'available'..."
while true; do
  STATUS=$(aws elasticache describe-serverless-caches \
    --serverless-cache-name "${CACHE_NAME}" \
    --region "${AWS_REGION}" \
    --query 'ServerlessCaches[0].Status' \
    --output text 2>/dev/null || echo "creating")
  
  if [ "${STATUS}" = "available" ]; then
    echo "==> Cache is now AVAILABLE!"
    break
  fi
  echo "    Current status: ${STATUS}. Waiting 15s..."
  sleep 15
done

REDIS_ENDPOINT=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "${CACHE_NAME}" \
  --region "${AWS_REGION}" \
  --query 'ServerlessCaches[0].Endpoint.Address' \
  --output text)

REDIS_PORT=$(aws elasticache describe-serverless-caches \
  --serverless-cache-name "${CACHE_NAME}" \
  --region "${AWS_REGION}" \
  --query 'ServerlessCaches[0].Endpoint.Port' \
  --output text)

echo "----------------------------------------------------------"
echo " Discovered Redis Endpoint: ${REDIS_ENDPOINT}"
echo " Discovered Redis Port:     ${REDIS_PORT}"
echo "----------------------------------------------------------"

# Function to update ECS task definition with the new REDIS_HOST
update_service_redis() {
  local service_name="$1"
  local family="$2"

  echo "==> [3/4] Updating task definition for ${service_name} (${family})..."
  CURRENT_TD=$(aws ecs describe-task-definition \
    --task-definition "${family}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition')

  NEW_TD=$(echo "${CURRENT_TD}" | python3 -c "
import json, sys
td = json.load(sys.stdin)
for k in ('taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(k, None)

# Update environment variables
for container in td.get('containerDefinitions', []):
    env_vars = container.get('environment', [])
    found_host = False
    found_port = False
    found_tls = False
    for item in env_vars:
        if item.get('name') == 'REDIS_HOST':
            item['value'] = '${REDIS_ENDPOINT}'
            found_host = True
        elif item.get('name') == 'REDIS_PORT':
            item['value'] = '${REDIS_PORT}'
            found_port = True
        elif item.get('name') == 'REDIS_TLS':
            item['value'] = 'true'
            found_tls = True
    if not found_host:
        env_vars.append({'name': 'REDIS_HOST', 'value': '${REDIS_ENDPOINT}'})
    if not found_port:
        env_vars.append({'name': 'REDIS_PORT', 'value': '${REDIS_PORT}'})
    if not found_tls:
        env_vars.append({'name': 'REDIS_TLS', 'value': 'true'})
    container['environment'] = env_vars

json.dump(td, sys.stdout)
")

  NEW_TD_ARN=$(aws ecs register-task-definition \
    --region "${AWS_REGION}" \
    --cli-input-json "${NEW_TD}" \
    --query 'taskDefinition.taskDefinitionArn' --output text)

  echo "    Registered new revision: ${NEW_TD_ARN}"

  echo "==> [4/4] Updating ECS service ${service_name}..."
  aws ecs update-service \
    --cluster "${CLUSTER}" \
    --service "${service_name}" \
    --task-definition "${NEW_TD_ARN}" \
    --force-new-deployment \
    --region "${AWS_REGION}" >/dev/null

  echo "    Service ${service_name} deployment triggered successfully."
}

update_service_redis "timesheet-api" "timesheet-api"
update_service_redis "timesheet-mail-worker" "timesheet-mail-worker"

echo "=========================================================="
echo " SUCCESS: ElastiCache Serverless connected to ECS!"
echo " Tasks are rotating with endpoint: ${REDIS_ENDPOINT}"
echo "=========================================================="
