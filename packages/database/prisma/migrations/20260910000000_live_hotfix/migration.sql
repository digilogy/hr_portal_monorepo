-- Fix for user table columns (missing in Live due to bypassed migration)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name" TEXT;

-- Safely backfill existing users with names from employee_data
UPDATE "user" u
SET name = e."fullName"
FROM "employee_data" e
WHERE (u.name IS NULL OR u.name = '') 
  AND LOWER(u.email) = LOWER(e."officialEmailId");

-- Drop unused columns safely
ALTER TABLE "user" DROP COLUMN IF EXISTS "first_name";
ALTER TABLE "user" DROP COLUMN IF EXISTS "last_name";
ALTER TABLE "user" DROP COLUMN IF EXISTS "phone";

-- Ensure missing EmployeeData columns exist in Live
ALTER TABLE "employee_data" ADD COLUMN IF NOT EXISTS "zone" TEXT;

-- Safely ensure all high-performance indexes are created in Live
CREATE INDEX IF NOT EXISTS "employee_data_department_subDepartment_idx" ON "employee_data"("department", "subDepartment");
CREATE INDEX IF NOT EXISTS "employee_data_zone_idx" ON "employee_data"("zone");
CREATE INDEX IF NOT EXISTS "employee_data_hodEmployeeId_idx" ON "employee_data"("hodEmployeeId");
CREATE INDEX IF NOT EXISTS "employee_data_directManagerEmployeeId_idx" ON "employee_data"("directManagerEmployeeId");
CREATE INDEX IF NOT EXISTS "timesheet_date_idx" ON "timesheet"("date");
