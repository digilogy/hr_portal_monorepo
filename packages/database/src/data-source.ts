import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Timesheet } from "./entities/Timesheet";
import { EmployeeData } from "./entities/EmployeeData";
import { UploadJob } from "./entities/UploadJob";
import { UploadLog } from "./entities/UploadLog";
import { EmailLog } from "./entities/EmailLog";
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
  entities: [User, Timesheet, EmployeeData, UploadJob, UploadLog, EmailLog],
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
    `);
  } catch (err) {
    console.warn("Notice: Failed to run automatic upload_log schema patch", err);
  }
  return AppDataSource;
}

