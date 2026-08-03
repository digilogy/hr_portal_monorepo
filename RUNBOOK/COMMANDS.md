# HR Portal — Running Commands & Instructions

All commands assume the repo root (`d:\Apps\hr-portal-monorepo`) unless noted otherwise.
Two ways to run this project: **Docker (recommended)** or **local workspace scripts (no Docker)**.

---

## 0. Prerequisites

- Node.js >= 22.0.0, npm >= 10.0.0
- Docker Desktop (for the Docker path)
- A `.env` file in `apps/api_hr_portal/` with DB, Redis, JWT, AWS/SES credentials
  (see `packages/config/src/index.ts` for the full list of recognized variables)

---

## 1. Install dependencies (both paths need this once)

```bash
npm install
```

---

## 2. Option A — Run everything with Docker

```bash
# Build and start Postgres, Redis, API, mail worker, and frontend in the background
docker-compose up -d

# Rebuild after changing Node.js/Next.js source
docker-compose up -d --build

# View logs
docker-compose logs -f
docker-compose logs -f api
docker-compose logs -f mail-worker
docker-compose logs -f frontend

# Stop containers (keeps DB/Redis data in volumes)
docker-compose down

# Stop AND wipe volumes (destroys DB data — use with care)
docker-compose down -v
```

### Docker service ports (host → container)

| Service | Host Port | Container Port |
| --- | --- | --- |
| API (`hr-api`) | 5111 | 5111 |
| Frontend (`hr-frontend`) | 3661 | 3661 |
| PostgreSQL (`hr-postgres`) | 5435 | 5432 |
| Redis (`hr-redis`) | 6380 | 6379 |

---

## 3. Option B — Run locally without Docker

Requires a local/reachable Postgres and Redis instance, and `DATABASE_URL` etc. set in
`apps/api_hr_portal/.env`.

```bash
# 1. Build all workspace packages once (packages/* must be built before the apps use them)
npm run build

# 2. Generate the Prisma client
npm run db:generate

# 3. Run migrations against your dev database
npm run db:migrate

# 4. Start the API (ts-node-dev, auto-restarts on change)
npm run dev --workspace=apps/api_hr_portal

# 5. Start the frontend (Next.js dev server on port 3661)
npm run dev --workspace=apps/hr_portal

# 6. Start the background mail worker (BullMQ, sends SES emails)
npm run worker --workspace=apps/api_hr_portal
```

---

## 4. Root-level workspace scripts (apply `--if-present` across all workspaces)

```bash
npm run dev      # dev in every workspace that defines it
npm run build    # build in every workspace that defines it
npm run test     # test in every workspace that defines it
npm run lint     # lint in every workspace that defines it
npm run format   # prettier --write across the repo
```

---

## 5. Database (Prisma, `packages/database`)

```bash
npm run db:generate         # prisma generate
npm run db:migrate          # prisma migrate dev   (creates/applies migrations, dev only)
npm run db:migrate:deploy   # prisma migrate deploy (applies existing migrations, prod-safe)
```

Run against a specific workspace directly if needed:

```bash
npm run db:migrate --workspace=@hr-portal/database
```

---

## 6. API app extra scripts (`apps/api_hr_portal`)

```bash
npm run start --workspace=apps/api_hr_portal            # ts-node src/index.ts (no watch)
npm run bulk-upload --workspace=apps/api_hr_portal       # scripts/run-bulk-upload.ts
npm run audit-employees --workspace=apps/api_hr_portal   # scripts/audit-employee-data.ts

# PM2 process management (production-style)
npm run pm2:start --workspace=apps/api_hr_portal
npm run pm2:stop --workspace=apps/api_hr_portal
npm run pm2:restart --workspace=apps/api_hr_portal
npm run pm2:logs --workspace=apps/api_hr_portal
```

---

## 7. Frontend app extra scripts (`apps/hr_portal`)

```bash
npm run build --workspace=apps/hr_portal   # next build
npm run start --workspace=apps/hr_portal   # next start --port 3661 (serves the build)
npm run lint --workspace=apps/hr_portal    # eslint
```

---

## 8. Third-party services required

- **Amazon SES** — transactional email (PIN setup/reset links). Needs `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL` (region `ap-south-2` by default).
- **Amazon S3** — reserved for admin bulk-upload presigned-URL flow (`packages/storage`),
  not yet wired in; uploads currently go to local disk via multer.

---

## 9. Notes

- All Node.js containers run in `Asia/Kolkata` (IST) — date filters like "Today"/"This Week"
  assume IST, not UTC.
- `docker-compose down` (without `-v`) preserves Postgres/Redis data in named volumes.
- Full architecture/service overview lives in [`../SETUP_GUIDE.md`](../SETUP_GUIDE.md).
