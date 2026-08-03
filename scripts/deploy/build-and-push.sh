#!/usr/bin/env bash
# =============================================================================
# Build all service images and push them to ECR.
#
# Usage: ./scripts/deploy/build-and-push.sh <image-tag> [service ...]
#   image-tag  usually the git short SHA or build number
#   service    optional subset: api mail-worker (default: both)
#
# Env overrides: AWS_REGION (default ap-south-1), ECR_PREFIX (default hr-portal-prod)
# =============================================================================
set -euo pipefail

TAG="${1:?Usage: build-and-push.sh <image-tag> [service ...]}"
shift || true
SERVICES=("${@:-}")
if [ -z "${SERVICES[0]:-}" ]; then SERVICES=(api mail-worker); fi

AWS_REGION="${AWS_REGION:-ap-south-1}"
ECR_PREFIX="${ECR_PREFIX:-hr-portal-prod}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> Logging in to ECR ${REGISTRY}"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}"

for svc in "${SERVICES[@]}"; do
  REPO="${REGISTRY}/${ECR_PREFIX}/${svc}"
  echo "==> Building ${svc} -> ${REPO}:${TAG}"
  docker build \
    -f "${ROOT_DIR}/infrastructure/docker/${svc}.Dockerfile" \
    -t "${REPO}:${TAG}" \
    -t "${REPO}:latest" \
    "${ROOT_DIR}"

  echo "==> Pushing ${REPO}:${TAG}"
  docker push "${REPO}:${TAG}"
  docker push "${REPO}:latest"
done

echo "==> All images pushed with tag ${TAG}"
