"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.initializeDatabase = initializeDatabase;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const User_1 = require("./entities/User");
const Timesheet_1 = require("./entities/Timesheet");
const EmployeeData_1 = require("./entities/EmployeeData");
const UploadJob_1 = require("./entities/UploadJob");
const UploadLog_1 = require("./entities/UploadLog");
const EmailLog_1 = require("./entities/EmailLog");
const Shift_1 = require("./entities/Shift");
const EmployeeShiftAssignment_1 = require("./entities/EmployeeShiftAssignment");
const Holiday_1 = require("./entities/Holiday");
const config_1 = require("@hr-portal/config");
const dbUrl = config_1.env.DATABASE_URL || process.env.DATABASE_URL;
const isProduction = config_1.env.NODE_ENV === "production";
const useSsl = config_1.env.DB_SSL === "true" || (isProduction && !config_1.env.DB_HOST?.includes("localhost") && !config_1.env.DB_HOST?.includes("postgres") && !dbUrl?.includes("localhost") && !dbUrl?.includes("@postgres:"));
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    ...(dbUrl
        ? { url: dbUrl }
        : {
            host: config_1.env.DB_HOST,
            port: config_1.env.DB_PORT,
            username: config_1.env.DB_USER,
            password: config_1.env.DB_PASSWORD,
            database: config_1.env.DB_NAME,
        }),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    // Disable automatic DDL synchronization in production to prevent "DROP INDEX check that it exists" errors
    synchronize: config_1.env.NODE_ENV !== "production" && config_1.env.TYPEORM_SYNCHRONIZE === "true",
    logging: false,
    entities: [User_1.User, Timesheet_1.Timesheet, EmployeeData_1.EmployeeData, UploadJob_1.UploadJob, UploadLog_1.UploadLog, EmailLog_1.EmailLog, Shift_1.Shift, EmployeeShiftAssignment_1.EmployeeShiftAssignment, Holiday_1.Holiday],
    migrations: [],
    subscribers: [],
});
async function initializeDatabase() {
    if (!exports.AppDataSource.isInitialized) {
        await exports.AppDataSource.initialize();
    }
    try {
        await exports.AppDataSource.query(`
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
    }
    catch (err) {
        console.warn("Notice: Failed to run automatic upload_log schema patch", err);
    }
    return exports.AppDataSource;
}
//# sourceMappingURL=data-source.js.map