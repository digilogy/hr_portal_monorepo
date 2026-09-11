# syntax=docker/dockerfile:1
# ==============================================================================
# @hr-portal/hr-portal — Next.js frontend, static export served by nginx
# (local dev/compose parity only — production serves the same `out/` build
# from S3 + CloudFront, per terraform/modules/frontend; there is no ECS
# service for the frontend since every route is static, matching
# ideas-staging-backend's "web" app deployment model.)
# ==============================================================================
FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Build stage ----
FROM base AS builder

COPY package.json package-lock.json ./
COPY apps/hr_portal/package.json ./apps/hr_portal/
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY apps/hr_portal ./apps/hr_portal

# Next.js inlines NEXT_PUBLIC_* vars into the static export at build time —
# it must match whatever host/port the browser will actually reach the API
# on, which is a docker-compose/deploy-time decision, not a fixed default.
ARG NEXT_PUBLIC_API_URL=http://localhost:5111
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build --workspace=@hr-portal/hr-portal

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/hr_portal/out /usr/share/nginx/html

EXPOSE 3661
# nginx defaults to port 80; rewrite to the app's conventional local port
RUN sed -i 's/listen  *80;/listen 3661;/' /etc/nginx/conf.d/default.conf && \
    sed -i '/listen 3661;/a \    error_page 404 /404.html;' /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
