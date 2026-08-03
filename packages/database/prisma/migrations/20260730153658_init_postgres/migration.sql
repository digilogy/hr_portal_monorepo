-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'hrbp', 'manager', 'employee');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('queued', 'processing', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('pin_setup', 'pin_reset');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "pin" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "slots" JSONB NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'saved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_data" (
    "id" SERIAL NOT NULL,
    "employmentStatus" TEXT,
    "employeeId" TEXT,
    "fullName" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "subDepartment" TEXT,
    "directManagerEmployeeId" TEXT,
    "directManagerName" TEXT,
    "hrbpEmployeeId" TEXT,
    "hrbpName" TEXT,
    "hodEmployeeId" TEXT,
    "hodEmployeeName" TEXT,
    "officialEmailId" TEXT,
    "officeMobileNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailType" "EmailType" NOT NULL,
    "payload" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "sesMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_job" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_log" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "details" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "timesheet_userId_date_idx" ON "timesheet"("userId", "date");

-- CreateIndex
CREATE INDEX "timesheet_userId_status_idx" ON "timesheet"("userId", "status");

-- CreateIndex
CREATE INDEX "timesheet_date_status_idx" ON "timesheet"("date", "status");

-- CreateIndex
CREATE INDEX "timesheet_date_idx" ON "timesheet"("date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_userId_date_key" ON "timesheet"("userId", "date");

-- CreateIndex
CREATE INDEX "employee_data_officialEmailId_idx" ON "employee_data"("officialEmailId");

-- CreateIndex
CREATE INDEX "employee_data_employeeId_idx" ON "employee_data"("employeeId");

-- CreateIndex
CREATE INDEX "employee_data_directManagerEmployeeId_idx" ON "employee_data"("directManagerEmployeeId");

-- CreateIndex
CREATE INDEX "employee_data_hrbpEmployeeId_idx" ON "employee_data"("hrbpEmployeeId");

-- CreateIndex
CREATE INDEX "employee_data_hodEmployeeId_idx" ON "employee_data"("hodEmployeeId");

-- CreateIndex
CREATE INDEX "employee_data_department_subDepartment_idx" ON "employee_data"("department", "subDepartment");

-- CreateIndex
CREATE INDEX "employee_data_employmentStatus_idx" ON "employee_data"("employmentStatus");

-- CreateIndex
CREATE INDEX "email_log_toEmail_status_idx" ON "email_log"("toEmail", "status");

-- CreateIndex
CREATE INDEX "email_log_status_createdAt_idx" ON "email_log"("status", "createdAt");

-- CreateIndex
CREATE INDEX "email_log_createdAt_idx" ON "email_log"("createdAt");

-- CreateIndex
CREATE INDEX "otp_email_expiresAt_idx" ON "otp"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "upload_log_jobId_idx" ON "upload_log"("jobId");

-- AddForeignKey
ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
