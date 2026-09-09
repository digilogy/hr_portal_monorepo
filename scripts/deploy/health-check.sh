#!/usr/bin/env bash
# =============================================================================
# Post-deployment health validation:
#   1. All ALB targets healthy in the api target group
#   2. /api/health returns 200 through the public HTTPS endpoint
#
# Usage: ./scripts/deploy/health-check.sh [api-domain]
# =============================================================================
set -euo pipefail

API_DOMAIN="${1:-${API_DOMAIN:-api.timesheet.cgworkflow.com}}"
AWS_REGION="${AWS_REGION:-ap-south-2}"
NAME_PREFIX="${NAME_PREFIX:-timesheet}"
RETRIES="${RETRIES:-10}"
SLEEP_SECONDS="${SLEEP_SECONDS:-15}"

check_target_group() {
  local tg_name="$1"
  local tg_arn
  tg_arn=$(aws elbv2 describe-target-groups --names "${tg_name}" \
    --region "${AWS_REGION}" --query 'TargetGroups[0].TargetGroupArn' --output text)

  local total healthy
  total=$(aws elbv2 describe-target-health --target-group-arn "${tg_arn}" \
    --region "${AWS_REGION}" --query 'length(TargetHealthDescriptions)' --output text)
  healthy=$(aws elbv2 describe-target-health --target-group-arn "${tg_arn}" \
    --region "${AWS_REGION}" \
    --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' --output text)

  echo "    ${tg_name}: ${healthy}/${total} healthy"
  [ "${total}" -gt 0 ] && [ "${healthy}" = "${total}" ]
}

check_endpoint() {
  local url="$1"
  local code
  code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "${url}" || echo "000")
  echo "    ${url} -> HTTP ${code}"
  [ "${code}" = "200" ]
}

for attempt in $(seq 1 "${RETRIES}"); do
  echo "==> Health check attempt ${attempt}/${RETRIES}"
  if check_target_group "${NAME_PREFIX}-api-tg" \
    && check_endpoint "https://${API_DOMAIN}/api/health"; then
    echo "==> All health checks passed"
    exit 0
  fi
  echo "    ...not healthy yet, retrying in ${SLEEP_SECONDS}s"
  sleep "${SLEEP_SECONDS}"
done

echo "!!> Health checks failed after ${RETRIES} attempts" >&2
exit 1
