import { Request, Response } from "express";
import { UploadQueueService } from "./uploadQueue.service";
import { EmailQueueService } from "../../services/emailQueue.service";
import { UploadLog, EmailStatus } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { shiftRepository } from "./shift.repository";

function formatJobResponse(job: NonNullable<Awaited<ReturnType<typeof UploadQueueService.getJobStatus>>>) {
  const failedLogs = (job.logs ?? []).filter(
    (log: UploadLog) => log.status === "failed",
  );

  return {
    ...job,
    addedCount: job.successCount,
    errors: failedLogs.map((log: UploadLog) => ({
      rowIndex: log.rowIndex,
      employeeId: log.employeeId,
      error: log.message,
      row: log.payload,
    })),
  };
}

export class AdminController {
  static async bulkUploadUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ message: "Please upload a CSV or Excel file" });
        return;
      }

      const jobId = await UploadQueueService.enqueueUpload(req.file.path);
      res.status(202).json({
        message: "Upload has been queued. Check status with the job ID.",
        jobId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async bulkUploadShifts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ message: "Please upload a CSV or Excel file" });
        return;
      }

      const jobId = await UploadQueueService.enqueueUpload(req.file.path, "shift");
      res.status(202).json({
        message: "Shift upload has been queued. Check status with the job ID.",
        jobId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async bulkUploadMaster(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ message: "Please upload a CSV or Excel file" });
        return;
      }

      const jobId = await UploadQueueService.enqueueUpload(req.file.path, "master");
      res.status(202).json({
        message: "Master data upload has been queued. Check status with the job ID.",
        jobId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getUploadStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await UploadQueueService.getJobStatus(jobId);
      if (!job) {
        res.status(404).json({ message: "Upload job not found" });
        return;
      }
      res.status(200).json({ job: formatJobResponse(job) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getEmployeeShifts(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as Record<string, string>;
      const shifts = await shiftRepository.getAllEmployeeShifts(filters);
      res.status(200).json(shifts);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getUploadHistory(req: Request, res: Response): Promise<void> {
    try {
      const type = req.query.type as string | undefined;
      const history = await UploadQueueService.getUploadHistory(type);
      res.status(200).json(history.map(formatJobResponse));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async downloadUploadFile(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await UploadQueueService.getJobStatus(jobId);
      if (!job || !job.filePath) {
        res.status(404).json({ message: "File not found" });
        return;
      }
      
      const fs = require('fs');
      if (!fs.existsSync(job.filePath)) {
        res.status(404).json({ message: "The original file was deleted from the server and is no longer available for download." });
        return;
      }
      
      res.download(job.filePath, job.fileName || "downloaded-file.xlsx");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async listEmailLogs(req: Request, res: Response): Promise<void> {
    try {
      const toEmail = typeof req.query.toEmail === "string" ? req.query.toEmail : undefined;
      const status =
        typeof req.query.status === "string" &&
        Object.values(EmailStatus).includes(req.query.status as EmailStatus)
          ? (req.query.status as EmailStatus)
          : undefined;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

      const result = await EmailQueueService.listEmailLogs({
        toEmail,
        status,
        limit,
        offset,
      });

      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getEmailLog(req: Request, res: Response): Promise<void> {
    try {
      const { emailLogId } = req.params;
      const log = await EmailQueueService.getEmailLog(emailLogId);
      if (!log) {
        res.status(404).json({ message: "Email log not found" });
        return;
      }
      res.status(200).json({ emailLog: log });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async retryEmailLog(req: Request, res: Response): Promise<void> {
    try {
      const { emailLogId } = req.params;
      const log = await EmailQueueService.retryFailedEmail(emailLogId);
      if (!log) {
        res.status(404).json({ message: "Failed email log not found" });
        return;
      }
      res.status(202).json({
        message: "Email re-queued for delivery",
        emailLog: log,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = logger.getLogs();
      res.status(200).json({ logs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }
}
