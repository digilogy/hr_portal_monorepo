-- Add a DB-level default to "updatedAt" columns.
-- TypeORM's @UpdateDateColumn emits the SQL DEFAULT keyword (not an explicit
-- timestamp) when inserting a new row, relying on the column's own default.
-- MySQL's Prisma provider auto-generates such a default; PostgreSQL does not,
-- which caused NOT NULL violations on every insert after the MySQL -> Postgres
-- migration.
ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "timesheet" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "employee_data" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "email_log" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "upload_job" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
