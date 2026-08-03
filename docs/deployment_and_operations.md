# HR Portal - Deployment, Security, and Load Testing Manual

This document details the configuration requirements, operational strategies, security policies, and performance verification mechanisms for deploying the HR/Timesheet Portal.

**This is the legacy Kubernetes-based deployment path**, kept for reference
only — matching how `ideas-staging-backend` itself keeps this document and
`infrastructure/kubernetes/`/`infrastructure/monitoring/` unused, superseded
by its ECS approach. The actively-used deployment path for hr-portal is
`docs/aws-deployment.md` (ECS Fargate via Terraform + Jenkins).

---

## 1. Production Deployment Guide (legacy Kubernetes path)

### Prerequisites
- Kubernetes cluster (v1.28+) with Nginx Ingress Controller installed.
- Managed MySQL database instance (e.g., AWS RDS MySQL 8) with pooling enabled.
- Redis cluster (e.g., AWS ElastiCache Redis v7) with `noeviction` (BullMQ requires jobs are never evicted).
- AWS S3 bucket (reserved for `packages/storage`'s presigned-upload migration — see Stage 10 notes below).

### Step-by-Step Cluster Setup
1. **Apply the Namespace**:
   ```bash
   kubectl apply -f infrastructure/kubernetes/namespace.yaml
   ```

2. **Deploy Configuration Maps & Secrets**:
   - Update `infrastructure/kubernetes/secrets.yaml` with actual base64-encoded strings of credentials.
   ```bash
   kubectl apply -f infrastructure/kubernetes/configmap.yaml
   kubectl apply -f infrastructure/kubernetes/secrets.yaml
   ```

3. **Deploy Storage & Network Layers**:
   ```bash
   kubectl apply -f infrastructure/kubernetes/ingress.yaml
   kubectl apply -f infrastructure/kubernetes/pdb.yaml
   ```

4. **Deploy Application Workloads**:
   ```bash
   kubectl apply -f infrastructure/kubernetes/api.yaml
   kubectl apply -f infrastructure/kubernetes/worker-scheduler.yaml
   ```
   (No `web.yaml` — the frontend is a static Next.js export, served from
   S3+CloudFront in the actual AWS path; it was never part of this cluster.)

5. **Run Migration**:
   - Access one of the API pods to run the migration:
   ```bash
   API_POD=$(kubectl get pods -n hr-portal -l app=hr-api -o jsonpath="{.items[0].metadata.name}")
   kubectl exec -it $API_POD -n hr-portal -- npm run db:migrate:deploy --workspace=@hr-portal/database
   ```

---

## 2. Production Security Checklist

This reflects main-zip's **actual current** security posture — including
gaps relative to `ideas-staging-backend`'s, called out explicitly rather
than glossed over.

| Checkpoint | Target Security Threat | Current State |
| :--- | :--- | :--- |
| **Domain Enforcement** | Unwanted sign-ups | `isDomainAllowed()` in `packages/common` checks the email's domain against a fixed allowlist (`casagrand.co.in`, etc.) before login/access-request. |
| **Single-Use Setup/Reset Tokens** | Token replay | Setup/reset tokens are generated via `crypto.randomBytes(32)`, stored in Redis with a 1-hour TTL, and atomically GET-and-DELETE'd on use (Lua script) to prevent replay under concurrency. Falls back to legacy JWT-signed tokens if not found in Redis. |
| **JWT Session** | Unauthorized access | A single 24h access token (`packages/auth`'s `signAuthToken`/`verifyAuthToken`) — **no refresh-token rotation**, unlike the reference's 15-minute access + rotating refresh token pair. This is a real gap, not yet addressed. |
| **Local-Disk Uploads** | API server resource exhaustion | Admin bulk-upload currently buffers through the API via `multer` disk storage — **not yet** direct-to-S3 presigned uploads like the reference. `packages/storage` exists with the right API surface (Stage 3h) but isn't wired up; migrating this is Stage 10. |
| **API Rate Limiting** | Brute force on login | `RedisService.isRateLimited()` throttles login attempts specifically (5 fails / 15 min lockout in `auth.service.ts`). **No blanket per-IP rate limiter** across all endpoints, unlike the reference's `fastify-rate-limit`. |
| **Security Headers** | XSS, Clickjacking, MIME sniffing | **Not currently implemented** — no `helmet`, no CSP, no CSRF cookie verification. This is a real gap worth addressing before wider production exposure. |
| **PIN Storage** | Credential leakage | PINs are hashed with bcrypt (`SecurityService.hashPin`/`verifyPin`, `packages/auth`), never stored or logged in plaintext. |

## 3. Load Testing Strategy

HR-portal-scale traffic (an internal tool for one organization's
employees) is far below the reference's 5,000+ concurrent public-user
target, so there's no equivalent load-testing requirement today. If load
testing becomes necessary, the same k6 approach applies — point it at
`/api/health` and the timesheet/report endpoints with a realistic
concurrent-employee-count ramp instead of 5,000 VUs.

### Load Test Script (using k6)
Create a test script `scratch/load_test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp-up
    { duration: '3m', target: 200 },  // Sustained load
    { duration: '1m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete under 300ms
    http_req_failed: ['rate<0.01'],    // Under 1% failures allowed
  },
};

const BASE_URL = 'https://api.example.com/api';

export default function () {
  const res = http.get(`${BASE_URL}/health`);

  check(res, {
    'health response is 200': (r) => r.status === 200,
    'health latency is within limit': (r) => r.timings.duration < 300,
  });

  sleep(1);
}
```
Run execution command:
```bash
k6 run scratch/load_test.js
```
