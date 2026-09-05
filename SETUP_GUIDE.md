# HR Portal - Setup & Architecture Guide

Welcome to the **HR Portal** project! This document provides a clean, simple overview of how the project works, what services it uses, and how to run it locally.

---

## 🚀 How to Run the Project (Local Development)

The entire backend infrastructure is containerized using **Docker**. Follow these steps to get everything running:

### 1. Environment Setup
Create your `.env` file (in `apps/api_hr_portal/`) with your database, Redis, and AWS credentials. See `packages/config/src/index.ts` for the full list of recognized variables.

### 2. Start the Backend Services
Run the following command in the terminal to start PostgreSQL, Redis, the API, the mail worker, and the frontend in the background:
```bash
docker-compose up -d
npm run dev --workspace=@hr-portal/hr-portal
docker-compose up -d --build api
/opt/homebrew/opt/openjdk@21/bin/java -Dmail.smtp.starttls.enable=true -Dhudson.plugins.git.GitSCM.ALLOW_LOCAL_CHECKOUT=true -jar /opt/homebrew/opt/jenkins-lts/libexec/jenkins.war --httpListenAddress=127.0.0.1 --httpPort=8080

```

### 3. Rebuilding after Code Changes
If you make changes to the Node.js or Next.js source code, rebuild the containers:
```bash
docker-compose up -d --build
```

### 4. Stop the Services
To safely stop and remove the running containers:
```bash
docker-compose down
```

*(Note: Stopping via `down` will not delete your database data. It is safely stored in a Docker volume).*

### 5. Running without Docker (workspace scripts)
```bash
npm install
npm run build
npm run dev --workspace=apps/api_hr_portal
npm run dev --workspace=apps/hr_portal
```

---

## 🏗️ Architecture & Services

We use a microservices-style architecture managed via Docker Compose.

### Core Services
| Service Name | Description | Port |
| :--- | :--- | :--- |
| **API** (`hr-api`) | The main backend for the Timesheet/HR Portal — auth, timesheets, reports, admin. | `5111` |
| **Mail Worker** (`hr-mail-worker`) | Background job processor (BullMQ) — sends PIN setup/reset emails via AWS SES. | `N/A` (Background) |
| **Frontend** (`hr-frontend`) | Next.js static export (dashboard, timesheet, reports, profile), served by nginx locally / S3+CloudFront in production. | `3661` |
| **PostgreSQL** (`hr-postgres`) | Relational database (primary data store). | `5432` |
| **Redis** (`hr-redis`) | In-memory store for the BullMQ mail queue, session/setup-token cache, and rate limiting. | `6379` |

---

## 🌍 Third-Party Services Integrated

The application relies on the following external services for full functionality:

### 1. Amazon SES (Simple Email Service)
- **Purpose:** Sending transactional emails (PIN setup links, PIN reset links).
- **Region:** `ap-south-2` (default)
- **Keys required:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`

### 2. Amazon S3 (Simple Storage Service)
- **Purpose:** Reserved for the admin bulk-upload flow's presigned-URL migration (`packages/storage`, Stage 10) — not yet wired into the running application; uploads are currently local-disk via multer.
- **Region:** `ap-south-1` (default)
- **Keys required:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

---

## 🕒 Timezone Information
All Node.js containers and backend logic are configured to run in **Indian Standard Time (IST) (`Asia/Kolkata`)**, matching the reference architecture's convention. This ensures date filters (like "Today" or "This Week" in timesheets/reports) behave as expected for Indian users without UTC conversion mismatches.




<!-- docker-compose down -->
<!-- docker-compose up -d -->