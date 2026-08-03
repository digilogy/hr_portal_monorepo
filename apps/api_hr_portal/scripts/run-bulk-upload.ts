import path from "path";
import dotenv from "dotenv";
import { AppDataSource, UploadJob, UploadJobStatus } from "@hr-portal/database";
import { EmployeeDataService } from "../src/modules/admin/employeeData.service";
import { logger } from "@hr-portal/logger";

dotenv.config();

const DEFAULT_FILE = path.join(
  __dirname,
  "..",
  "Master - Digilogy.xlsx",
);

async function main() {
  const filePath = path.resolve(process.argv[2] || DEFAULT_FILE);

  logger.info("BulkUploadScript", "Initializing database connection");
  await AppDataSource.initialize();

  const jobRepository = AppDataSource.getRepository(UploadJob);
  const job = jobRepository.create({
    fileName: path.basename(filePath),
    filePath,
    status: UploadJobStatus.PROCESSING,
    totalRows: 0,
    successCount: 0,
    failureCount: 0,
  });
  const savedJob = await jobRepository.save(job);

  logger.info("BulkUploadScript", "Starting upload from file", {
    jobId: savedJob.id,
    filePath,
  });

  try {
    const result = await EmployeeDataService.processBulkUpload(
      filePath,
      savedJob,
    );

    savedJob.totalRows = result.totalRows;
    savedJob.successCount = result.successCount;
    savedJob.failureCount = result.failureCount;
    savedJob.status = UploadJobStatus.COMPLETED;
    savedJob.updatedAt = new Date();
    await jobRepository.save(savedJob);

    console.log("\n=== Bulk Upload Summary ===");
    console.log(`Job ID:        ${savedJob.id}`);
    console.log(`Total rows:    ${result.totalRows}`);
    console.log(`Success:       ${result.successCount} (${result.addedCount} added, ${result.updatedCount} updated)`);
    console.log(`Failed:        ${result.failureCount}`);
    if (result.errors.length > 0) {
      console.log("\nFirst 10 errors:");
      result.errors.slice(0, 10).forEach((entry) => {
        console.log(
          `  Row ${entry.rowIndex}: ${entry.error} (${entry.row.employeeId || entry.row.officialEmailId || "unknown"})`,
        );
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    savedJob.status = UploadJobStatus.FAILED;
    savedJob.errorMessage = message;
    savedJob.updatedAt = new Date();
    await jobRepository.save(savedJob);
    logger.error("BulkUploadScript", "Upload failed", { error: message });
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  logger.error("BulkUploadScript", "Unexpected error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
