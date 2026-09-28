import path from "path";
import fs from "fs";
import os from "os";
import { pipeline } from "stream/promises";
import { getS3FileStream } from "@hr-portal/storage";
import { UploadJob, UploadJobStatus } from "@hr-portal/database";
import { EmployeeDataService } from "./employeeData.service";
import { ShiftUploadService } from "./shiftUpload.service";
import { logger } from "@hr-portal/logger";
import { uploadQueueRepository } from "./uploadQueue.repository";

const jobQueue: string[] = [];
let isProcessing = false;

const LOG_CONTEXT = "UploadQueue";

async function downloadS3ToTempFile(s3Uri: string): Promise<string> {
  const s3Key = s3Uri.replace(/^s3:\/\//, "");
  const tempPath = path.join(os.tmpdir(), `s3_download_${Date.now()}_${path.basename(s3Key)}`);
  const s3Stream = await getS3FileStream(s3Key);
  const writeStream = fs.createWriteStream(tempPath);
  await pipeline(s3Stream, writeStream);
  return tempPath;
}

async function processNextJob(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) return;
  isProcessing = true;

  try {
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

      let workingFilePath = job.filePath ?? "";
      let isTempS3File = false;

      try {
        if (workingFilePath.startsWith("s3://")) {
          workingFilePath = await downloadS3ToTempFile(workingFilePath);
          isTempS3File = true;
        }

        let result;
        if (job.type === "master") {
          const shiftResult = await ShiftUploadService.processBulkUpload(workingFilePath, job, { deleteFile: false });
          const employeeResult = await EmployeeDataService.processBulkUpload(workingFilePath, job, { deleteFile: false });
          result = {
            totalRows: employeeResult.totalRows + shiftResult.totalRows,
            successCount: employeeResult.successCount + shiftResult.successCount,
            failureCount: employeeResult.failureCount + shiftResult.failureCount,
            addedCount: employeeResult.addedCount + (shiftResult.addedCount || 0),
            updatedCount: employeeResult.updatedCount + (shiftResult.updatedCount || 0),
          };
        } else if (job.type === "shift") {
          result = await ShiftUploadService.processBulkUpload(workingFilePath, job, { deleteFile: false });
        } else {
          result = await EmployeeDataService.processBulkUpload(workingFilePath, job, { deleteFile: false });
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
      } finally {
        if (isTempS3File && workingFilePath && fs.existsSync(workingFilePath)) {
          try {
            fs.unlinkSync(workingFilePath);
          } catch (unlinkErr) {
            logger.warn(LOG_CONTEXT, "Failed to clean up temp S3 file", { path: workingFilePath, error: unlinkErr });
          }
        }
      }
    }
  } catch (fatalError: unknown) {
    logger.error(LOG_CONTEXT, "Fatal error in processNextJob loop", {
      error: fatalError instanceof Error ? fatalError.message : String(fatalError),
    });
  } finally {
    isProcessing = false;
  }
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

  static async getUploadHistory(type?: any): Promise<UploadJob[]> {
    return uploadQueueRepository.findAll(type);
  }
}
