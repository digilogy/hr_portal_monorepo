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
import { env } from "@hr-portal/config";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // Disable automatic DDL synchronization in production to prevent "DROP INDEX check that it exists" errors
  synchronize: env.NODE_ENV !== "production" && env.TYPEORM_SYNCHRONIZE === "true",
  logging: false,
  entities: [User, Timesheet, EmployeeData, UploadJob, UploadLog, EmailLog, Shift, EmployeeShiftAssignment],
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
        "startTime" VARCHAR NOT NULL,
        "endTime" VARCHAR NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "employee_shift_assignments" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" VARCHAR NOT NULL,
        "policy" VARCHAR,
        "weeklyOff" VARCHAR,
        "shiftId" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_shift_assignment" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE NO ACTION
      );
      
      CREATE INDEX IF NOT EXISTS "idx_emp_shift_employee_id" ON "employee_shift_assignments" ("employeeId");
    `);
  } catch (err) {
    console.warn("Notice: Failed to run automatic upload_log schema patch", err);
  }
  return AppDataSource;
}

