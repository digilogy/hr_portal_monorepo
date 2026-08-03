import {
  EmailLog,
  EmailPayload,
  EmailStatus,
  EmailType,
} from "@hr-portal/database";
import { EmailService } from "@hr-portal/mail";
import { logger } from "@hr-portal/logger";
import { isRedisConnected } from "@hr-portal/queue";
import { enqueueTrackedEmail, enqueueExistingTrackedEmail } from "@hr-portal/notification";
import { env } from "@hr-portal/config";
import { emailQueueRepository } from "../repositories/emailQueue.repository";

const jobQueue: string[] = [];
const scheduledRetries = new Map<string, ReturnType<typeof setTimeout>>();
let isProcessing = false;

const LOG_CONTEXT = "EmailQueue";
const MAX_ATTEMPTS = env.EMAIL_MAX_ATTEMPTS;
const RETRY_BASE_DELAY_MS = env.EMAIL_RETRY_DELAY_MS;
const SEND_INTERVAL_MS = env.EMAIL_SEND_INTERVAL_MS;

export interface EnqueueEmailInput {
  toEmail: string;
  emailType: EmailType;
  subject: string;
  link: string;
  description: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attemptCount: number): number {
  return RETRY_BASE_DELAY_MS * Math.max(attemptCount, 1);
}

async function markProcessing(log: EmailLog): Promise<void> {
  log.status = EmailStatus.PROCESSING;
  log.updatedAt = new Date();
  await emailQueueRepository.save(log);
}

async function markSent(log: EmailLog, messageId?: string): Promise<void> {
  log.status = EmailStatus.SENT;
  log.sesMessageId = messageId;
  log.sentAt = new Date();
  log.errorMessage = undefined;
  log.nextRetryAt = undefined;
  log.updatedAt = new Date();
  await emailQueueRepository.save(log);
}

async function markFailedOrRetry(log: EmailLog, errorMessage: string): Promise<void> {
  log.attemptCount += 1;
  log.errorMessage = errorMessage;
  log.updatedAt = new Date();

  if (log.attemptCount >= log.maxAttempts) {
    log.status = EmailStatus.FAILED;
    log.nextRetryAt = undefined;
    await emailQueueRepository.save(log);

    logger.error(LOG_CONTEXT, "Email permanently failed", {
      emailLogId: log.id,
      toEmail: log.toEmail,
      emailType: log.emailType,
      attemptCount: log.attemptCount,
      error: errorMessage,
    });
    return;
  }

  const delayMs = getRetryDelayMs(log.attemptCount);
  log.status = EmailStatus.QUEUED;
  log.nextRetryAt = new Date(Date.now() + delayMs);
  await emailQueueRepository.save(log);

  logger.warn(LOG_CONTEXT, "Email send failed, scheduled retry", {
    emailLogId: log.id,
    toEmail: log.toEmail,
    attemptCount: log.attemptCount,
    maxAttempts: log.maxAttempts,
    retryInMs: delayMs,
    error: errorMessage,
  });

  scheduleRetry(log.id, delayMs);
}

function scheduleRetry(emailLogId: string, delayMs: number): void {
  const existing = scheduledRetries.get(emailLogId);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    scheduledRetries.delete(emailLogId);
    pushToQueue(emailLogId);
    void processNextJob();
  }, delayMs);

  scheduledRetries.set(emailLogId, timeout);
}

function pushToQueue(emailLogId: string): void {
  if (!jobQueue.includes(emailLogId)) {
    jobQueue.push(emailLogId);
  }
}

async function processEmailLog(emailLogId: string): Promise<void> {
  const log = await emailQueueRepository.findById(emailLogId);
  if (!log) return;

  if (log.status === EmailStatus.SENT) return;

  if (log.nextRetryAt && log.nextRetryAt.getTime() > Date.now()) {
    const delayMs = log.nextRetryAt.getTime() - Date.now();
    scheduleRetry(log.id, delayMs);
    return;
  }

  await markProcessing(log);

  logger.info(LOG_CONTEXT, "Processing email", {
    emailLogId: log.id,
    toEmail: log.toEmail,
    emailType: log.emailType,
    attempt: log.attemptCount + 1,
    maxAttempts: log.maxAttempts,
  });

  const payload = log.payload as EmailPayload | undefined;
  if (!payload?.link) {
    await markFailedOrRetry(log, "Missing email payload link");
    return;
  }

  try {
    const result = await EmailService.sendPinEmail({
      toEmail: log.toEmail,
      subject: log.subject,
      link: payload.link,
      description: payload.description,
    });

    await markSent(log, result.messageId);

    logger.info(LOG_CONTEXT, "Email sent", {
      emailLogId: log.id,
      toEmail: log.toEmail,
      emailType: log.emailType,
      sesMessageId: result.messageId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown SES error";
    await markFailedOrRetry(log, message);
  }
}

async function processNextJob(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const emailLogId = jobQueue.shift();
    if (!emailLogId) continue;

    await processEmailLog(emailLogId);

    if (jobQueue.length > 0 && SEND_INTERVAL_MS > 0) {
      await sleep(SEND_INTERVAL_MS);
    }
  }

  isProcessing = false;
}

export class EmailQueueService {
  static async enqueue(input: EnqueueEmailInput): Promise<string> {
    const { log: saved, queuedToBullMq } = await enqueueTrackedEmail({
      toEmail: input.toEmail,
      emailType: input.emailType,
      subject: input.subject,
      link: input.link,
      description: input.description,
      maxAttempts: MAX_ATTEMPTS,
    });

    if (!queuedToBullMq) {
      // In-memory process queue fallback if Redis is unavailable
      logger.info(LOG_CONTEXT, "Email queued (Local fallback)", {
        emailLogId: saved.id,
        toEmail: saved.toEmail,
      });
      pushToQueue(saved.id);
      void processNextJob();
    }

    return saved.id;
  }

  static async recoverPendingJobs(): Promise<void> {
    const pending = await emailQueueRepository.findPending();

    if (pending.length === 0) return;

    for (const log of pending) {
      if (log.status === EmailStatus.PROCESSING) {
        log.status = EmailStatus.QUEUED;
        await emailQueueRepository.save(log);
      }

      if (log.nextRetryAt && log.nextRetryAt.getTime() > Date.now()) {
        scheduleRetry(log.id, log.nextRetryAt.getTime() - Date.now());
      } else {
        const queued = await enqueueExistingTrackedEmail(log, `retry-${log.id}`);
        if (!queued) {
          pushToQueue(log.id);
        }
      }
    }

    logger.info(LOG_CONTEXT, "Recovered pending email jobs", {
      count: pending.length,
    });

    if (!isRedisConnected) {
      void processNextJob();
    }
  }

  static async getEmailLog(emailLogId: string): Promise<EmailLog | null> {
    return await emailQueueRepository.findById(emailLogId);
  }

  static async listEmailLogs(options: {
    toEmail?: string;
    status?: EmailStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ items: EmailLog[]; total: number }> {
    return emailQueueRepository.findLogs(options);
  }

  static async retryFailedEmail(emailLogId: string): Promise<EmailLog | null> {
    const log = await emailQueueRepository.findById(emailLogId);
    if (!log || log.status !== EmailStatus.FAILED) return log;

    log.status = EmailStatus.QUEUED;
    log.attemptCount = 0;
    log.errorMessage = undefined;
    log.nextRetryAt = undefined;
    log.updatedAt = new Date();
    await emailQueueRepository.save(log);

    logger.info(LOG_CONTEXT, "Failed email manually re-queued", {
      emailLogId: log.id,
      toEmail: log.toEmail,
    });

    const queued = await enqueueExistingTrackedEmail(log, `retry-manual-${log.id}`);
    if (!queued) {
      pushToQueue(log.id);
      void processNextJob();
    }

    return log;
  }
}
