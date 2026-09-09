import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Timesheet } from "./entities/Timesheet";
import { EmployeeData } from "./entities/EmployeeData";
import { UploadJob } from "./entities/UploadJob";
import { UploadLog } from "./entities/UploadLog";
import { EmailLog } from "./entities/EmailLog";
import { Shift } from "./entities/Shift";
import { EmployeeShiftAssignment } from "./entities/EmployeeShiftAssignment";
import { Holiday } from "./entities/Holiday";
import { env } from "@hr-portal/config";

const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
const isProduction = env.NODE_ENV === "production";
const useSsl = env.DB_SSL === "true" || (isProduction && !env.DB_HOST?.includes("localhost") && !env.DB_HOST?.includes("postgres") && !dbUrl?.includes("localhost") && !dbUrl?.includes("@postgres:"));

export const AppDataSource = new DataSource({
  type: "postgres",
  ...(dbUrl
    ? { url: dbUrl }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        username: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
      }),
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  // Disable automatic DDL synchronization in production to prevent "DROP INDEX check that it exists" errors
  synchronize: env.NODE_ENV !== "production" && env.TYPEORM_SYNCHRONIZE === "true",
  logging: false,
  entities: [User, Timesheet, EmployeeData, UploadJob, UploadLog, EmailLog, Shift, EmployeeShiftAssignment, Holiday],
  migrations: [],
  subscribers: [],
});

export async function initializeDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  try {
    await AppDataSource.query(`
      ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "rowIndex" INTEGER;
      ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "status" VARCHAR;
      ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "message" TEXT;
      ALTER TABLE "upload_log" ADD COLUMN IF NOT EXISTS "payload" JSONB;
      ALTER TABLE "upload_log" ALTER COLUMN "action" DROP NOT NULL;
      ALTER TABLE "upload_job" ADD COLUMN IF NOT EXISTS "type" VARCHAR DEFAULT 'employee';

      CREATE TABLE IF NOT EXISTS "shifts" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL UNIQUE,
        "allowedTimings" VARCHAR,
        "workingDays" VARCHAR,
        "offDays" VARCHAR,
        "halfDay" VARCHAR,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
      
      -- Alter table in case it already exists with old schema
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "allowedTimings" VARCHAR;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "workingDays" VARCHAR;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "offDays" VARCHAR;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "halfDay" VARCHAR;
      ALTER TABLE "shifts" DROP COLUMN IF EXISTS "startTime";
      ALTER TABLE "shifts" DROP COLUMN IF EXISTS "endTime";

      CREATE TABLE IF NOT EXISTS "employee_shift_assignments" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" VARCHAR NOT NULL,
        "policy" VARCHAR,
        "weeklyOff" VARCHAR,
        "preferredTiming" VARCHAR,
        "shiftId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_shift_assignment" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE NO ACTION
      );
      
      ALTER TABLE "employee_shift_assignments" ADD COLUMN IF NOT EXISTS "preferredTiming" VARCHAR;

      CREATE INDEX IF NOT EXISTS "idx_emp_shift_employee_id" ON "employee_shift_assignments" ("employeeId");

      ALTER TABLE "employee_data" ADD COLUMN IF NOT EXISTS "zone" VARCHAR;

      CREATE TABLE IF NOT EXISTS "holiday" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL,
        "startDate" DATE NOT NULL,
        "endDate" DATE NOT NULL,
        "zones" JSON NOT NULL,
        "isOptional" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS "idx_holiday_start_end" ON "holiday" ("startDate", "endDate");
    `);
  } catch (err) {
    console.warn("Notice: Failed to run automatic upload_log schema patch", err);
  }
  return AppDataSource;
}

