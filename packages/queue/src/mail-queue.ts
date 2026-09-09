import { Queue } from "bullmq";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";
import { redisClient, isRedisConnected } from "./redis-connection";

const LOG_CONTEXT = "MailQueue";

export const MAIL_QUEUE_NAME = "mail-queue";
export const QUEUE_PREFIX = "{bull}";

export interface MailJobPayload {
  emailLogId: string;
  toEmail: string;
  subject: string;
  link: string;
  description: string;
}

let bullMailQueue: Queue<MailJobPayload> | null = null;

export function getBullMailQueue(): Queue<MailJobPayload> | null {
  if (!bullMailQueue) {
    try {
      bullMailQueue = new Queue<MailJobPayload>(MAIL_QUEUE_NAME, {
        prefix: QUEUE_PREFIX,
        connection: redisClient,
        defaultJobOptions: {
          attempts: env.EMAIL_MAX_ATTEMPTS,
          backoff: {
            type: "exponential",
            delay: env.EMAIL_RETRY_DELAY_MS,
          },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 5000 },
        },
      });
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "Failed to initialize BullMQ queue", { error: err.message });
      bullMailQueue = null;
    }
  }
  return bullMailQueue;
}
