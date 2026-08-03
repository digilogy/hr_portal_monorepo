# syntax=docker/dockerfile:1
# ==============================================================================
# hr-mail-worker — BullMQ mail queue processor (no HTTP surface)
# Shares apps/api_hr_portal's codebase (the worker entry lives at
# src/workers/mail.worker.ts, run via `npm run worker` / pm2 today) — same
# 1:1 match to ideas-staging-backend's dedicated worker app, just without
# its own top-level apps/ workspace since main-zip has no separate worker
# package.json.
# ==============================================================================
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Build stage ----
FROM base AS builder

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

RUN npm prune --omit=dev \
    && npm run db:generate --workspace=@hr-portal/database

# ---- Runtime stage ----
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/api_hr_portal/package.json ./apps/api_hr_portal/package.json
COPY --from=builder --chown=node:node /app/apps/api_hr_portal/dist ./apps/api_hr_portal/dist

USER node

CMD ["node", "apps/api_hr_portal/dist/workers/mail.worker.js"]
