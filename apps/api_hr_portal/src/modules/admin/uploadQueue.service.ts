import path from "path";
import { UploadJob, UploadJobStatus } from "@hr-portal/database";
import { EmployeeDataService } from "./employeeData.service";
import { ShiftUploadService } from "./shiftUpload.service";
import { logger } from "@hr-portal/logger";
import { uploadQueueRepository } from "./uploadQueue.repository";

const jobQueue: string[] = [];
let isProcessing = false;

const LOG_CONTEXT = "UploadQueue";

async function processNextJob(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const jobId = jobQueue.shift();
    if (!jobId) continue;
    const job = await uploadQueueRepository.findById(jobId);
    if (!job) continue;

    logger.info(LOG_CONTEXT, "Processing upload job", {
      jobId: job.id,
      fileName: job.fileName,
    });

    job.status = UploadJobStatus.PROCESSING;
    job.updatedAt = new Date();
    await uploadQueueRepository.save(job);

    try {
      let result;
      if (job.type === "master") {
        const shiftResult = await ShiftUploadService.processBulkUpload(job.filePath ?? "", job, { deleteFile: false });
        const employeeResult = await EmployeeDataService.processBulkUpload(job.filePath ?? "", job, { deleteFile: true });
        result = {
          totalRows: employeeResult.totalRows,
          successCount: employeeResult.successCount,
          failureCount: employeeResult.failureCount + shiftResult.failureCount,
          addedCount: employeeResult.addedCount,
          updatedCount: employeeResult.updatedCount,
        };
      } else if (job.type === "shift") {
        result = await ShiftUploadService.processBulkUpload(job.filePath ?? "", job, { deleteFile: true });
      } else {
        result = await EmployeeDataService.processBulkUpload(job.filePath ?? "", job, { deleteFile: true });
      }

      job.totalRows = result.totalRows;
      job.successCount = result.successCount;
      job.failureCount = result.failureCount;
      job.status = UploadJobStatus.COMPLETED;
      job.updatedAt = new Date();
      await uploadQueueRepository.save(job);

      logger.info(LOG_CONTEXT, "Upload job completed", {
        jobId: job.id,
        totalRows: result.totalRows,
        successCount: result.successCount,
        addedCount: result.addedCount,
        updatedCount: result.updatedCount,
        failureCount: result.failureCount,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      job.status = UploadJobStatus.FAILED;
      job.errorMessage = message;
      job.updatedAt = new Date();
      await uploadQueueRepository.save(job);

      logger.error(LOG_CONTEXT, "Upload job failed", {
        jobId: job.id,
        error: message,
      });
    }
  }

  isProcessing = false;
}

export class UploadQueueService {
  static async enqueueUpload(filePath: string, jobType: "employee" | "shift" | "master" = "employee"): Promise<string> {
    const job = uploadQueueRepository.create({
      fileName: path.basename(filePath),
      filePath,
      status: UploadJobStatus.QUEUED,
      type: jobType as any,
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
    });
    const savedJob = await uploadQueueRepository.save(job);

    logger.info(LOG_CONTEXT, "Upload job queued", {
      jobId: savedJob.id,
      fileName: savedJob.fileName,
      queueLength: jobQueue.length + 1,
    });

    jobQueue.push(savedJob.id);
    void processNextJob();

    return savedJob.id;
  }

  static async getJobStatus(jobId: string): Promise<UploadJob | null> {
    return uploadQueueRepository.findByIdWithLogs(jobId);
  }
}
