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

# 1. Install all dependencies across the monorepo
npm install

# 2. Start ONLY the database and cache first
docker-compose up -d postgres redis

# 3. Create the database tables in PostgreSQL
npm run db:migrate --workspace=@hr-portal/database

# 4. Build and start all backend APIs & workers
docker-compose up -d --build

# 5. Start the frontend locally
npm run dev --workspace=@hr-portal/hr-portal

docker-compose build --no-cache admin-api && docker-compose up -d


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

## 🌐 API Endpoint Reference

This section provides a comprehensive list of all API endpoints exposed by the HR Portal Gateway, categorized by microservice and purpose.

### Authentication (`/api/auth`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/request-access` | Request an email access link/setup token. |
| `GET` | `/api/auth/verify-token` | Verify the setup token. |
| `POST` | `/api/auth/setup-pin` | Set up the user's PIN for the first time. |
| `POST` | `/api/auth/login` | Login to receive a JWT access token. |
| `POST` | `/api/auth/forgot-pin` | Trigger the forgot PIN email flow. |

### Profile (`/api/profile`)
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/profile/me` | Fetch the logged-in user's profile information. |
| `PUT` | `/api/profile/me/preferred-timing` | Update the user's preferred work shift timings. |

### Timesheets (`/api/timesheets`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/timesheets/save` | Save or update timesheet entries for a specific day. |
| `GET` | `/api/timesheets/history` | Fetch historical timesheet data and statuses. |
| `GET` | `/api/timesheets/day/:date` | Fetch detailed timesheet entries for a single specific day. |

### Reports (`/api/reports`)
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/reports/filter-options` | Fetch all available report filter dropdown options (departments, managers, etc). |
| `GET` | `/api/reports/filter-options/scoped` | Fetch cascaded/scoped filter options based on actively selected filters. |
| `GET` | `/api/reports/capabilities` | Check report viewing capabilities for the current user's role. |
| `GET` | `/api/reports/user-wise` | View individual user-wise metrics and timesheet compliance. |
| `GET` | `/api/reports/manager-wise` | View manager-wise metrics and timesheet compliance. |
| `GET` | `/api/reports/department-wise` | View department-wise metrics and timesheet compliance. |
| `GET` | `/api/reports/organization-wise` | View organization-wide metrics and timesheet compliance. |
| `GET` | `/api/reports/dashboard-summary` | Fetch high-level aggregated metrics for the HR Dashboard view. |
| `GET` | `/api/reports/workforce-pulse` | View granular workforce activity insights and hour distribution. |
| `GET` | `/api/reports/export/excel` | Export report data to an Excel file. |
| `GET` | `/api/reports/export/pdf` | Export report data to a PDF file. |
| `GET` | `/api/reports/employee-timesheets` | Fetch detailed timesheets for specific individual employees. |

### Team (`/api/team`)
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/team/roster` | Retrieve the hierarchical team roster and employee structure. |

### Admin (`/api/admin`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/admin/bulk-upload` | Bulk upload employee data via CSV/Excel. |
| `POST` | `/api/admin/bulk-upload-shifts` | Bulk upload employee shift schedules via CSV/Excel. |
| `POST` | `/api/admin/bulk-upload-master` | Bulk upload master configuration data via CSV/Excel. |
| `GET` | `/api/admin/bulk-upload/status/:jobId` | Check the background processing status of a bulk upload job. |
| `GET` | `/api/admin/email-logs` | List all historical email logs and statuses. |
| `GET` | `/api/admin/email-logs/:emailLogId` | Fetch the exact details and body of a specific email log. |
| `POST` | `/api/admin/email-logs/:emailLogId/retry` | Retry sending an email that previously failed. |
| `GET` | `/api/admin/logs` | View application-level audit logs. |
| `GET` | `/api/admin/holidays` | Fetch all configured company holidays. |
| `POST` | `/api/admin/holidays` | Create a new company holiday entry. |
| `PUT` | `/api/admin/holidays/:id` | Update an existing company holiday entry. |
| `DELETE` | `/api/admin/holidays/:id` | Delete a company holiday entry. |

### Diagnostics & Health
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Basic heartbeat health check endpoint. |
| `GET` | `/api/echoconf` | View active sanitized configuration and environment parameters. |
| `GET` | `/logxz` (or `/api/logxz`) | Stream live raw server logs via Server-Sent Events (SSE). |
| `POST` | `/logxz/clear` (or `/api/logxz/clear`) | Clear the live raw server logs from memory. |











node test_all_apis.js

Starting API ping test...

✅ [POST] /api/auth/login - 72ms (Status: 200)
✅ [GET] /api/auth/verify-token - 3ms (Status: 400)
✅ [GET] /api/profile/me - 43ms (Status: 200)
✅ [GET] /api/timesheets/history?fromDate=2026-09-01&toDate=2026-09-10 - 6ms (Status: 200)
✅ [GET] /api/timesheets/day/2026-09-01 - 9ms (Status: 200)
✅ [GET] /api/reports/filter-options - 252ms (Status: 200)
✅ [GET] /api/reports/filter-options/scoped - 176ms (Status: 200)
✅ [GET] /api/reports/capabilities - 5ms (Status: 200)
✅ [GET] /api/reports/user-wise?fromDate=2026-09-01&toDate=2026-09-10 - 86ms (Status: 200)
✅ [GET] /api/reports/manager-wise?fromDate=2026-09-01&toDate=2026-09-10 - 240ms (Status: 200)
✅ [GET] /api/reports/department-wise?fromDate=2026-09-01&toDate=2026-09-10 - 359ms (Status: 200)
✅ [GET] /api/reports/organization-wise?fromDate=2026-09-01&toDate=2026-09-10 - 170ms (Status: 200)
✅ [GET] /api/reports/dashboard-summary?fromDate=2026-09-01&toDate=2026-09-10 - 545ms (Status: 200)
✅ [GET] /api/reports/workforce-pulse?fromDate=2026-09-01&toDate=2026-09-10 - 622ms (Status: 200)
✅ [GET] /api/team/roster - 136ms (Status: 200)
✅ [GET] /api/admin/email-logs - 48ms (Status: 200)
✅ [GET] /api/admin/logs - 5ms (Status: 200)
✅ [GET] /api/admin/holidays - 13ms (Status: 200)
✅ [GET] /api/health - 1ms (Status: 200)
✅ [GET] /api/echoconf - 1ms (Status: 200)
✅ [GET] /logxz - 1ms (Status: SSE Stream)











# HR Portal API Endpoints

This document provides a comprehensive list of all API endpoints exposed by the HR Portal Gateway.

## Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/request-access` | Request an email access link/token |
| `GET` | `/api/auth/verify-token` | Verify the setup token |
| `POST` | `/api/auth/setup-pin` | Set up the user's PIN |
| `POST` | `/api/auth/login` | Login to receive a JWT |
| `POST` | `/api/auth/forgot-pin` | Trigger the forgot PIN flow |

## Profile (`/api/profile`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profile/me` | Get the logged-in user's profile |
| `PUT` | `/api/profile/me/preferred-timing` | Update the user's preferred work timings |

## Timesheets (`/api/timesheets`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/timesheets/save` | Save or update timesheet entries |
| `GET` | `/api/timesheets/history` | Get timesheet history |
| `GET` | `/api/timesheets/day/:date` | Get timesheet details for a specific day |

## Reports (`/api/reports`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports/filter-options` | Get all available report filter dropdown options |
| `GET` | `/api/reports/filter-options/scoped` | Get cascaded filter options based on active filters |
| `GET` | `/api/reports/capabilities` | Check report capabilities for the user |
| `GET` | `/api/reports/user-wise` | User-wise metrics and timesheet compliance |
| `GET` | `/api/reports/manager-wise` | Manager-wise metrics and timesheet compliance |
| `GET` | `/api/reports/department-wise` | Department-wise metrics and timesheet compliance |
| `GET` | `/api/reports/organization-wise` | Organization-wise metrics and timesheet compliance |
| `GET` | `/api/reports/dashboard-summary` | High-level metrics for the HR Dashboard |
| `GET` | `/api/reports/workforce-pulse` | Granular workforce activity insights |
| `GET` | `/api/reports/export/excel` | Export report data to Excel |
| `GET` | `/api/reports/export/pdf` | Export report data to PDF |
| `GET` | `/api/reports/employee-timesheets` | Get detailed timesheets for specific employees |

## Team (`/api/team`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/team/roster` | Get the team roster hierarchy |

## Admin (`/api/admin`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/bulk-upload` | Bulk upload employee data |
| `POST` | `/api/admin/bulk-upload-shifts` | Bulk upload shift schedules |
| `POST` | `/api/admin/bulk-upload-master` | Bulk upload master data |
| `GET` | `/api/admin/bulk-upload/status/:jobId` | Check the status of a bulk upload job |
| `GET` | `/api/admin/email-logs` | List all email logs |
| `GET` | `/api/admin/email-logs/:emailLogId` | Get details for a specific email log |
| `POST` | `/api/admin/email-logs/:emailLogId/retry` | Retry sending a failed email |
| `GET` | `/api/admin/logs` | View application logs |
| `GET` | `/api/admin/holidays` | Get all holidays |
| `POST` | `/api/admin/holidays` | Create a new holiday |
| `PUT` | `/api/admin/holidays/:id` | Update an existing holiday |
| `DELETE` | `/api/admin/holidays/:id` | Delete a holiday |

## Diagnostics & Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/api/echoconf` | View active sanitized configuration |
| `GET` | `/logxz` | (or `/api/logxz`) View live raw server logs |
| `POST` | `/logxz/clear` | (or `/api/logxz/clear`) Clear live raw server logs |












Here is the list of endpoints for the three backend APIs, along with a brief explanation of what each one does:

### 1. Main API (`app.ts`)
This is the primary gateway that handles core user-facing features (like authentication, managing timesheets, and profile settings) and proxies other requests to the internal microservices.

**General Endpoints:**
- `GET /api/health` - Checks if the Main API is up and running.
- `GET /api/echoconf` - Returns the sanitized current configuration/environment settings for diagnostics.
- `GET /api/logxz` / `POST /api/logxz/clear` - Fetches or clears the live server logs (useful for debugging without SSH access).

**Authentication (`/api/auth`)** - *Handles the employee login lifecycle:*
- `POST /api/auth/request-access` - Initiates the login process (usually by validating an email and sending an OTP).
- `GET /api/auth/verify-token` - Validates the setup/login token sent via email or OTP.
- `POST /api/auth/setup-pin` - Allows a user to set up their 4-digit or 6-digit PIN for quicker subsequent logins.
- `POST /api/auth/login` - Authenticates a user (via their PIN) and returns a JWT session token.
- `POST /api/auth/forgot-pin` - Initiates a PIN reset workflow.

**Timesheets (`/api/timesheets`)** - *Handles logging and reading time entries:*
- `POST /api/timesheets/save` - Submits or updates timesheet entries for a specific day.
- `GET /api/timesheets/history` - Fetches historical timesheet records for the logged-in user.
- `GET /api/timesheets/day/:date` - Retrieves the timesheet entries for a specific, single date.

**Profile (`/api/profile`)** - *Handles user-specific settings:*
- `GET /api/profile/me` - Retrieves the currently logged-in user's profile details.
- `PUT /api/profile/me/preferred-timing` - Updates the employee's preferred work schedule/timing preferences.

---

### 2. Admin API (`admin.app.ts`)
This microservice handles heavy, administrative operations that are typically restricted to users with `ADMIN` roles. It offloads expensive tasks (like processing large CSVs) from the main API.

**General:**
- `GET /api/health` - Checks if the Admin API is up and running.

**Admin & Bulk Uploads (`/api/admin`)** - *Handles importing large datasets into the system:*
- `POST /api/admin/bulk-upload` - Uploads a CSV/Excel file to bulk create or update user accounts.
- `POST /api/admin/bulk-upload-shifts` - Uploads a file to bulk assign shifts to employees.
- `POST /api/admin/bulk-upload-master` - Uploads master data (e.g., departments, designations) into the system.
- `GET /api/admin/bulk-upload/status/:jobId` - Checks the progress of an asynchronous bulk upload job.
- `GET /api/admin/bulk-upload/download/:jobId` - Downloads the results or error report of a bulk upload job.
- `GET /api/admin/bulk-upload/history` - Lists previously executed bulk upload jobs.
- `GET /api/admin/employee-shifts` - Fetches a paginated list of all employees and their assigned shifts.

**Logs & Monitoring (`/api/admin`)** - *For auditing system behavior:*
- `GET /api/admin/logs` - Retrieves system-level audit or error logs.
- `GET /api/admin/email-logs` - Lists the history of emails sent by the system (e.g., OTPs, notifications).
- `GET /api/admin/email-logs/:emailLogId` - Fetches the exact details and content of a specific sent email.
- `POST /api/admin/email-logs/:emailLogId/retry` - Re-attempts sending an email that previously failed.

**Holidays (`/api/admin/holidays`)** - *Manages the organization's holiday calendar:*
- `GET /api/admin/holidays` - Lists all configured company holidays.
- `POST /api/admin/holidays` - Creates a new holiday entry.
- `PUT /api/admin/holidays/:id` - Updates an existing holiday.
- `DELETE /api/admin/holidays/:id` - Removes a holiday.

---

### 3. Reports API (`reports.app.ts`)
This microservice is strictly read-only and is optimized for querying, aggregating, and exporting timesheet and employee data for managers and HR.

**General:**
- `GET /api/health` - Checks if the Reports API is up and running.

**Team (`/api/team`):**
- `GET /api/team/roster` - Retrieves the team roster (list of direct/indirect reports) for a manager.

**Reports & Dashboards (`/api/reports`)** - *Fetches aggregated analytical data:*
- `GET /api/reports/filter-options` - Gets the dropdown options available for global reporting filters (e.g., list of all departments, managers).
- `GET /api/reports/filter-options/scoped` - Similar to above, but scoped only to the data the requesting manager has permission to see.
- `GET /api/reports/capabilities` - Returns the reporting features and permissions the current user has access to.
- `GET /api/reports/dashboard-summary` - Provides high-level KPIs and summaries for the main dashboard view.
- `GET /api/reports/user-wise` - Aggregates timesheet data broken down by individual users.
- `GET /api/reports/manager-wise` - Aggregates timesheet data grouped by managers.
- `GET /api/reports/department-wise` - Aggregates timesheet data grouped by department.
- `GET /api/reports/organization-wise` - Provides an organization-wide roll-up of timesheet metrics.
- `GET /api/reports/signed-up-users` - Lists employees who have successfully onboarded/signed up vs those pending.
- `GET /api/reports/workforce-pulse` - Likely provides attendance, active hours, or engagement metrics across the workforce.
- `GET /api/reports/employee-timesheets` - A detailed, tabular view of individual timesheets for reporting purposes.

**Exports (`/api/reports/export`):**
- `GET /api/reports/export/excel` - Generates and downloads the current report view as an Excel spreadsheet.
- `GET /api/reports/export/pdf` - Generates and downloads the current report view as a PDF document.