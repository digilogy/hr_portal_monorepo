# AWS Production Deployment Guide

Complete runbook for deploying **hr-portal** to AWS from a fresh account
using Terraform, Docker, and Jenkins.

## Architecture

```
                        Route 53 (example.com)
                              │
                    api.example.com         jenkins.example.com
                              │                     │
                    ┌─────────▼──────────┐   ┌──────▼──────┐
Internet ──HTTPS──▶ │  ALB (ACM cert)    │   │ Jenkins EC2 │
                    │  80→443 redirect   │   │ (public)    │
                    └─────────┬──────────┘   └─────────────┘
              ┌───────────────┼───────────────┐   PUBLIC SUBNETS
──────────────┼───────────────┼───────────────┼──────────────────
              ▼               │               │   PRIVATE APP SUBNETS
        ┌───────────┐         │        ┌─────────────┐
        │ ECS api   │         │        │ ECS mail-   │
        │ 2–6 tasks │         │        │ worker      │
        └─────┬─────┘         │        │ 1 task      │
──────────────┼───────────────┼────────┴──────┬──────┼──────────
              ▼               │               ▼      │   PRIVATE DATA SUBNETS
        ┌──────────────────────────┐  ┌──────────────────────────┐
        │ RDS MySQL 8               │  │ ElastiCache Redis 7      │
        │ (Secrets Manager password)│  │ (BullMQ: noeviction)     │
        └──────────────────────────┘  └──────────────────────────┘

Frontend: hr.example.com → CloudFront → S3 (static Next.js export, no ECS)
External: SES ap-south-2 (email) · S3 uploads bucket (reserved, Stage 10)
Observability: CloudWatch logs/metrics/dashboard/alarms → SNS email
```

Key security properties:

- ECS tasks run in private subnets with **no public IPs**; only the ALB is exposed.
- **No static AWS keys anywhere** — ECS task IAM roles provide S3/SES access,
  the Jenkins instance profile provides ECR/ECS access.
- Secrets (`DATABASE_URL`, `DB_PASSWORD`, `JWT_SECRET`, admin credentials)
  live in **Secrets Manager** and are injected into containers by ECS; they
  never appear in task definitions, images, or Git.
- Security groups are least-privilege: ALB→app port only, app→RDS/Redis only.

## Prerequisites

1. AWS account with admin credentials configured (`aws configure`).
2. Route 53 hosted zone for your domain in the same account.
3. SES: sender identity verified in **ap-south-2** (matches
   `email.service.ts`'s default region), production access (out of
   sandbox) requested.
4. Terraform >= 1.7, Docker, AWS CLI v2 on the machine running the initial deploy.

## First deployment (fresh account)

### Step 1 — Terraform state backend

```bash
./scripts/deploy/bootstrap-terraform-state.sh ap-south-1
```

Creates the state S3 bucket + DynamoDB lock table and writes
`terraform/envs/production/backend.hcl`.

### Step 2 — Configure variables

```bash
cd terraform/envs/production
cp terraform.tfvars.example terraform.tfvars
# edit: root_domain, api_domain, frontend_domain, jenkins_domain,
#       s3_bucket_name, allowed_origins, ses_from_email, admin_user,
#       admin_pin, alarm_email, jenkins_admin_cidrs, ...
```

### Step 3 — Core infrastructure (ECR + Jenkins first)

The ECS services need images that don't exist yet, so create the registry
(and CI host) first:

```bash
terraform init -backend-config=backend.hcl
terraform plan  -target=module.ecr -target=module.jenkins -target=module.iam
terraform apply -target=module.ecr -target=module.jenkins -target=module.iam
```

### Step 4 — Build and push the first images

From any Docker-capable machine with AWS credentials (or the new Jenkins host):

```bash
./scripts/deploy/build-and-push.sh v1
```

### Step 5 — Everything else

```bash
terraform plan  -var image_tag=v1
terraform apply -var image_tag=v1
```

This creates VPC, ALB + ACM cert (auto-validated via Route 53), RDS,
ElastiCache, Secrets, ECS services, the S3+CloudFront frontend, DNS
records, dashboard, and alarms. Confirm the SNS subscription email that
arrives at `alarm_email`.

### Step 6 — Database migration

```bash
./scripts/deploy/run-migrations.sh v1
```

Runs `prisma migrate deploy` (not `db push`) — applies the tracked
migration history from `packages/database/prisma/migrations/`.

### Step 7 — Deploy the frontend

```bash
cd apps/hr_portal
npm ci && npm run build   # produces out/ (static export)
aws s3 sync out/ "s3://<frontend_bucket>/" --delete --region ap-south-1
aws cloudfront create-invalidation --distribution-id <distribution_id> --paths "/*"
```

(The Jenkins pipeline's "Deploy Frontend" stage does this automatically
on every build that touches `apps/hr_portal/**`.)

### Step 8 — Validate

```bash
./scripts/deploy/health-check.sh api.example.com
curl -s https://api.example.com/api/health
```

## Jenkins setup (one time)

1. Wait ~5 minutes after apply for the bootstrap to finish, then open
   `https://jenkins.example.com` (the Let's Encrypt cert is issued
   automatically within ~10 minutes of DNS propagating; use
   `http://<jenkins_public_ip>` before that).
2. Get the initial password:
   `aws ssm start-session --target <instance-id>` then
   `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`.
3. Install suggested plugins + **Pipeline**, **Git**, **AnsiColor**.
4. New item → *Pipeline* → "Pipeline script from SCM" → your Git repo →
   script path `Jenkinsfile`.
5. Add a webhook from your Git host to
   `https://jenkins.example.com/github-webhook/` (or poll SCM).

No AWS credentials are configured in Jenkins — the EC2 instance profile
covers ECR push and ECS deploy with least privilege.

## The pipeline (every deploy)

`Jenkinsfile` stages:

1. **Checkout** — tag = `<build#>-<git-sha>`
2. **Install** — `npm ci`
3. **Lint & Test** — `npm run lint` / `npm test` (currently pass-through;
   becomes a real gate when tests are added)
4. **Build & Push** — 2 images → ECR (`build-and-push.sh`)
5. **Database Migration** — one-off Fargate task runs `prisma migrate deploy`
   with the new image (`run-migrations.sh`)
6. **Deploy** — mail-worker → api, each waits for stability (`deploy-service.sh`)
7. **Health Check** — target group + public `/api/health` (`health-check.sh`)
8. **Deploy Frontend** — only when `apps/hr_portal/**` or `packages/common/**`
   changed: builds the static export and syncs it to S3 + invalidates CloudFront
9. **Rollback** — automatic two ways: the ECS **deployment circuit breaker**
   rolls a failing service back, and the pipeline fails if the new revision
   isn't the one running. Manual: `./scripts/deploy/rollback.sh <service>`
10. **Cleanup** — docker prune + workspace clean
11. **Notifications** — placeholder in `post { }` (wire Slack/SES there)

## Scaling posture

HR-portal-scale traffic is far below a public idea-submission portal's, so
sizing defaults here are deliberately conservative:

| Layer | Baseline | Scales to | Trigger |
|---|---|---|---|
| api | 2 × 0.5 vCPU/1GB | 6 tasks | CPU 60% |
| mail-worker | 1 task fixed | — | queue-driven, tune `mail_worker_desired_count` |
| RDS | db.t3.medium | vertical | TypeORM's own pool size (no Prisma runtime pool) |
| Redis | cache.t4g.micro | vertical | alarms at 80% memory/CPU |

If load testing later shows these are undersized, bump `api_cpu`/
`api_memory`/`api_max_tasks`/`rds_instance_class`/`redis_node_type` in
`terraform.tfvars` — every one is a plain variable, no code change needed.

## Operations quick reference

```bash
# Manual rollback of one service to its previous revision
./scripts/deploy/rollback.sh api

# Tail logs
aws logs tail /ecs/hr-portal-prod-api --follow --region ap-south-1

# Shell into a running container
aws ecs execute-command --cluster hr-portal-prod-cluster \
  --task <task-id> --container api --interactive --command "/bin/bash"

# Scale mail-worker count without Terraform
aws ecs update-service --cluster hr-portal-prod-cluster \
  --service hr-portal-prod-mail-worker --desired-count 2
```

## Cost estimate (defaults, ap-south-1, approx.)

| Item | ~USD/month |
|---|---|
| Fargate baseline (2 api + 1 mail-worker tasks) | 25–35 |
| RDS db.t3.medium single-AZ + 20GB gp3 | 55 |
| ElastiCache cache.t4g.micro | 12 |
| NAT gateway (1) + data | 35+ |
| ALB | 25+ |
| Jenkins t3.medium + EBS + EIP | 35 |
| CloudFront + S3 (frontend + uploads) | 5–10 |
| CloudWatch/ECR/Secrets/Route53 | 10–15 |
| **Total baseline** | **≈ $200–225** |

Cost levers: stop Jenkins outside work hours (`t3.medium` is already the
smaller of the reference's two Jenkins sizes). `nat_gateway_count` is
already at its floor of 1 — private-subnet workloads need at least one
NAT gateway for image pulls/SES/S3 access. Autoscaling adds Fargate cost
only while traffic is high.

## Legacy files

`infrastructure/kubernetes/` and `infrastructure/monitoring/` predate this
setup and are **not used** by the AWS deployment; kept for reference only,
matching ideas-staging-backend's own retained-but-unused legacy artifacts.
