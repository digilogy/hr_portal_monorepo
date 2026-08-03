import { AppDataSource, EmailLog, EmailPayload, EmailStatus, EmailType } from "@hr-portal/database";
import { getBullMailQueue } from "@hr-portal/queue";
import { logger } from "@hr-portal/logger";

const LOG_CONTEXT = "Notification";

export interface EnqueueTrackedEmailInput {
  toEmail: string;
  emailType: EmailType;
  subject: string;
  link: string;
  description: string;
  maxAttempts: number;
}

export interface EnqueueTrackedEmailResult {
  log: EmailLog;
  queuedToBullMq: boolean;
}

/**
 * Creates a tracked EmailLog row (status QUEUED) and attempts to enqueue it
 * to the shared BullMQ mail queue. Callers own the fallback path for when
 * queuedToBullMq is false (e.g. Redis unavailable) — this function never
 * decides retry/backoff behavior itself.
 */
export async function enqueueTrackedEmail(
  input: EnqueueTrackedEmailInput,
): Promise<EnqueueTrackedEmailResult> {
  const payload: EmailPayload = {
    link: input.link,
    description: input.description,
  };

  const repo = AppDataSource.getRepository(EmailLog);
  const log = repo.create({
    toEmail: input.toEmail,
    subject: input.subject,
    emailType: input.emailType,
    payload,
    status: EmailStatus.QUEUED,
    attemptCount: 0,
    maxAttempts: input.maxAttempts,
  });
  const saved = await repo.save(log);

  const bQueue = getBullMailQueue();
  if (!bQueue) {
    return { log: saved, queuedToBullMq: false };
  }

  await bQueue.add(`send-${input.emailType.toLowerCase()}-${saved.id}`, {
    emailLogId: saved.id,
    toEmail: input.toEmail,
    subject: input.subject,
    link: input.link,
    description: input.description,
  });

  logger.info(LOG_CONTEXT, "Email queued to BullMQ", {
    emailLogId: saved.id,
    toEmail: saved.toEmail,
    emailType: saved.emailType,
  });

  return { log: saved, queuedToBullMq: true };
}

/**
 * Re-enqueues an existing tracked EmailLog row (recovery / manual retry) to
 * the shared BullMQ mail queue. Returns false when there's no queue
 * connection or the log has no payload link, so callers can fall back.
 */
export async function enqueueExistingTrackedEmail(
  log: EmailLog,
  jobName: string,
): Promise<boolean> {
  const bQueue = getBullMailQueue();
  const payload = log.payload as EmailPayload | undefined;
  if (!bQueue || !payload?.link) return false;

  await bQueue.add(jobName, {
    emailLogId: log.id,
    toEmail: log.toEmail,
    subject: log.subject,
    link: payload.link,
    description: payload.description,
  });

  return true;
}
