import dotenv from "dotenv";
dotenv.config();

import { Worker, Job } from "bullmq";
import { redisClient, MAIL_QUEUE_NAME, MailJobPayload } from "@hr-portal/queue";
import { EmailService } from "@hr-portal/mail";
import { logger } from "@hr-portal/logger";
import { initializeDatabase, AppDataSource, EmailLog, EmailStatus } from "@hr-portal/database";

const LOG_CONTEXT = "MailWorker";

export function startMailWorker(): Worker<MailJobPayload> {
  const worker = new Worker<MailJobPayload>(
    MAIL_QUEUE_NAME,
    async (job: Job<MailJobPayload>) => {
      const { emailLogId, toEmail, subject, link, description } = job.data;

      logger.info(LOG_CONTEXT, `Processing email job ${job.id} for ${toEmail}`, { emailLogId });

      let emailLog: EmailLog | null = null;
      if (AppDataSource.isInitialized) {
        const repo = AppDataSource.getRepository(EmailLog);
        emailLog = await repo.findOneBy({ id: emailLogId });
        if (emailLog) {
          emailLog.status = EmailStatus.PROCESSING;
          emailLog.updatedAt = new Date();
          await repo.save(emailLog);
        }
      }

      try {
        const result = await EmailService.sendPinEmail({
          toEmail,
          subject,
          link,
          description,
        });

        if (emailLog && AppDataSource.isInitialized) {
          const repo = AppDataSource.getRepository(EmailLog);
          emailLog.status = EmailStatus.SENT;
          emailLog.sesMessageId = result.messageId;
          emailLog.sentAt = new Date();
          emailLog.updatedAt = new Date();
          await repo.save(emailLog);
        }

        logger.info(LOG_CONTEXT, `Email job ${job.id} sent successfully`, {
          emailLogId,
          toEmail,
          sesMessageId: result.messageId,
        });
      } catch (err: any) {
        logger.error(LOG_CONTEXT, `Failed email job ${job.id}`, { error: err.message, emailLogId });
        if (emailLog && AppDataSource.isInitialized) {
          const repo = AppDataSource.getRepository(EmailLog);
          emailLog.attemptCount += 1;
          emailLog.errorMessage = err.message;
          emailLog.status = emailLog.attemptCount >= emailLog.maxAttempts ? EmailStatus.FAILED : EmailStatus.QUEUED;
          emailLog.updatedAt = new Date();
          await repo.save(emailLog);
        }
        throw err; // Re-throw to trigger BullMQ retry backoff
      }
    },
    {
      connection: redisClient,
      concurrency: 20, // High concurrency for enterprise throughput
    }
  );

  worker.on("completed", (job) => {
    logger.info(LOG_CONTEXT, `Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(LOG_CONTEXT, `Job ${job?.id} failed permanently or exhausted attempts`, { error: err.message });
  });

  return worker;
}

// Auto-run if executed via `npm run worker`
if (require.main === module) {
  logger.info(LOG_CONTEXT, "Starting standalone Mail Worker instance...");
  initializeDatabase()
    .then(() => {
      startMailWorker();
    })
    .catch((err) => {
      logger.error(LOG_CONTEXT, "Database initialization error in worker process", { error: err.message });
    });
}
