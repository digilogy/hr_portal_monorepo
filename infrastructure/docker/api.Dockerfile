# syntax=docker/dockerfile:1
# ==============================================================================
# @hr-portal/api-hr-portal — production image
# Multi-stage: deps+build in one stage, minimal non-root runtime stage.
# ==============================================================================
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Build stage ----
FROM base AS builder

# Install with only manifests first so this layer caches across code changes
COPY package.json package-lock.json ./
COPY apps/api_hr_portal/package.json ./apps/api_hr_portal/
COPY packages/auth/package.json ./packages/auth/
COPY packages/common/package.json ./packages/common/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/logger/package.json ./packages/logger/
COPY packages/mail/package.json ./packages/mail/
COPY packages/notification/package.json ./packages/notification/
COPY packages/queue/package.json ./packages/queue/
COPY packages/storage/package.json ./packages/storage/
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY packages ./packages
COPY apps/api_hr_portal ./apps/api_hr_portal

RUN npm run db:generate --workspace=@hr-portal/database \
    && npm run build --workspace=@hr-portal/config \
    && npm run build --workspace=@hr-portal/logger \
    && npm run build --workspace=@hr-portal/common \
    && npm run build --workspace=@hr-portal/database \
    && npm run build --workspace=@hr-portal/queue \
    && npm run build --workspace=@hr-portal/storage \
    && npm run build --workspace=@hr-portal/auth \
    && npm run build --workspace=@hr-portal/mail \
    && npm run build --workspace=@hr-portal/notification \
    && npm run build --workspace=@hr-portal/api-hr-portal

# Drop devDependencies, then regenerate the Prisma client (prisma CLI is a
# production dependency so migrations can run from this image on ECS)
RUN npm prune --omit=dev \
    && npm run db:generate --workspace=@hr-portal/database

# ---- Runtime stage ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=5111

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/api_hr_portal/package.json ./apps/api_hr_portal/package.json
COPY --from=builder --chown=node:node /app/apps/api_hr_portal/dist ./apps/api_hr_portal/dist

USER node
EXPOSE 5111

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:5111/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "apps/api_hr_portal/dist/index.js"]
