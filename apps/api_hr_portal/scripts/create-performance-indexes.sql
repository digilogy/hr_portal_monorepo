-- ==============================================================================
-- Production High-Performance MySQL / MariaDB Indexes Script
-- Target Database: hr-portal
-- Matches exact table names: user, timesheet, employee_data, email_log, otp, upload_log
-- ==============================================================================

-- 1. User Table Indexes
CREATE UNIQUE INDEX `idx_user_email` ON `user` (`email`);
CREATE INDEX `idx_user_role` ON `user` (`role`);

-- 2. Timesheet High-Throughput Indexes
CREATE UNIQUE INDEX `idx_timesheet_user_date` ON `timesheet` (`userId`, `date`);
CREATE INDEX `idx_timesheet_user_status` ON `timesheet` (`userId`, `status`);
CREATE INDEX `idx_timesheet_date_status` ON `timesheet` (`date`, `status`);
CREATE INDEX `idx_timesheet_date` ON `timesheet` (`date`);

-- 3. Employee Master Data Hierarchy Indexes
CREATE INDEX `idx_emp_official_email` ON `employee_data` (`officialEmailId`);
CREATE INDEX `idx_emp_employee_id` ON `employee_data` (`employeeId`);
CREATE INDEX `idx_emp_manager_id` ON `employee_data` (`directManagerEmployeeId`);
CREATE INDEX `idx_emp_hrbp_id` ON `employee_data` (`hrbpEmployeeId`);
CREATE INDEX `idx_emp_hod_id` ON `employee_data` (`hodEmployeeId`);
CREATE INDEX `idx_emp_dept_subdept` ON `employee_data` (`department`, `subDepartment`);
CREATE INDEX `idx_emp_status` ON `employee_data` (`employmentStatus`);

-- 4. Queue & Background Email Indexes
CREATE INDEX `idx_email_to_status` ON `email_log` (`toEmail`, `status`);
CREATE INDEX `idx_email_status_created` ON `email_log` (`status`, `createdAt`);
CREATE INDEX `idx_email_created_at` ON `email_log` (`createdAt`);

-- 5. OTP & Verification Indexes
CREATE INDEX `idx_otp_email_expires` ON `otp` (`email`, `expiresAt`);

-- 6. Audit & Log Upload Indexes
CREATE INDEX `idx_upload_log_job_id` ON `upload_log` (`jobId`);
