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
import { shiftRepository } from "./shift.repository";
import { TimesheetRealignService } from "../../services/timesheetRealign.service";
import {
  clearUploadCancelled,
  isUploadCancelled,
  markUploadCancelled,
  UploadCancelledError,
} from "./uploadCancellation";

const jobQueue: string[] = [];
let isProcessing = false;

/**
 * Master upload replaces old data: shifts that are no longer in the Shift Detail tab are removed,
 * unless an employee is still assigned to one. Skipped when the tab named no shifts at all, so a
 * broken file can't wipe every shift.
 */
async function removeShiftsNotInSheet(job: UploadJob, fileShiftKeys: Set<string>): Promise<void> {
  if (fileShiftKeys.size === 0) {
    logger.warn("UploadQueue", "Shift Detail named no shifts; old shifts kept", { jobId: job.id });
    return;
  }
  try {
    const removed = await shiftRepository.deleteUnusedShifts(fileShiftKeys);
    logger.info("UploadQueue", "Removed shifts not in this upload", { jobId: job.id, removed });
  } catch (error) {
    logger.error("UploadQueue", "Failed to remove shifts not in this upload", { jobId: job.id, error });
  }
}

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
      if (!job || isUploadCancelled(job.id)) {
        clearUploadCancelled(jobId);
        continue;
      }

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
          const employeeResult = await EmployeeDataService.processBulkUpload(workingFilePath, job, {
            deleteFile: false,
            rejectedShifts: shiftResult.rejectedShifts,
          });
          await removeShiftsNotInSheet(job, shiftResult.fileShiftKeys);
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

        // Cancelled right after the last row: keep the cancelled status the admin saw.
        if (isUploadCancelled(job.id)) throw new UploadCancelledError(job.id);

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

        // Shift timings or assignments may have changed: move saved entries onto the new slots.
        TimesheetRealignService.realignAllInBackground(`${job.type} upload ${job.id}`);
      } catch (error: unknown) {
        if (error instanceof UploadCancelledError) {
          // cancel() already saved the job as failed with who cancelled it.
          logger.info(LOG_CONTEXT, "Upload job stopped after cancel", { jobId: job.id });
          continue;
        }
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
        clearUploadCancelled(job.id);
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

  /**
   * Stops a queued or running upload and marks it failed. Also clears a job left "processing"
   * after a restart, which nothing is running any more. Rows already imported stay imported.
   */
  static async cancel(jobId: string, cancelledBy?: string): Promise<UploadJob> {
    const job = await uploadQueueRepository.findById(jobId);
    if (!job) throw new Error("Upload job not found");
    if (job.status !== UploadJobStatus.QUEUED && job.status !== UploadJobStatus.PROCESSING) {
      throw new Error("This upload has already finished");
    }

    const queuedIndex = jobQueue.indexOf(jobId);
    if (queuedIndex !== -1) jobQueue.splice(queuedIndex, 1);
    else if (isProcessing) markUploadCancelled(jobId); // running here: stop at the next row

    job.status = UploadJobStatus.FAILED;
    job.errorMessage = `Cancelled${cancelledBy ? ` by ${cancelledBy}` : ""}. Rows imported before cancelling are kept; re-upload to finish.`;
    const saved = await uploadQueueRepository.save(job);

    logger.info(LOG_CONTEXT, "Upload job cancelled", { jobId, cancelledBy });
    return saved;
  }

  static async getJobStatus(jobId: string): Promise<UploadJob | null> {
    return uploadQueueRepository.findByIdWithLogs(jobId);
  }

  static async getUploadHistory(type?: any): Promise<UploadJob[]> {
    return uploadQueueRepository.findAll(type);
  }
}
