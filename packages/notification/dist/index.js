"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueTrackedEmail = enqueueTrackedEmail;
exports.enqueueExistingTrackedEmail = enqueueExistingTrackedEmail;
const database_1 = require("@hr-portal/database");
const queue_1 = require("@hr-portal/queue");
const logger_1 = require("@hr-portal/logger");
const LOG_CONTEXT = "Notification";
/**
 * Creates a tracked EmailLog row (status QUEUED) and attempts to enqueue it
 * to the shared BullMQ mail queue. Callers own the fallback path for when
 * queuedToBullMq is false (e.g. Redis unavailable) — this function never
 * decides retry/backoff behavior itself.
 */
async function enqueueTrackedEmail(input) {
    const payload = {
        link: input.link,
        description: input.description,
    };
    const repo = database_1.AppDataSource.getRepository(database_1.EmailLog);
    const log = repo.create({
        toEmail: input.toEmail,
        subject: input.subject,
        emailType: input.emailType,
        payload,
        status: database_1.EmailStatus.QUEUED,
        attemptCount: 0,
        maxAttempts: input.maxAttempts,
    });
    const saved = await repo.save(log);
    const bQueue = (0, queue_1.getBullMailQueue)();
    if (!bQueue) {
        return { log: saved, queuedToBullMq: false };
    }
    try {
        await bQueue.add(`send-${input.emailType.toLowerCase()}-${saved.id}`, {
            emailLogId: saved.id,
            toEmail: input.toEmail,
            subject: input.subject,
            link: input.link,
            description: input.description,
        });
        logger_1.logger.info(LOG_CONTEXT, "Email queued to BullMQ", {
            emailLogId: saved.id,
            toEmail: saved.toEmail,
            emailType: saved.emailType,
        });
        return { log: saved, queuedToBullMq: true };
    }
    catch (err) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to enqueue email to BullMQ, falling back to local queue", {
            emailLogId: saved.id,
            error: err?.message || String(err),
        });
        return { log: saved, queuedToBullMq: false };
    }
}
/**
 * Re-enqueues an existing tracked EmailLog row (recovery / manual retry) to
 * the shared BullMQ mail queue. Returns false when there's no queue
 * connection or the log has no payload link, so callers can fall back.
 */
async function enqueueExistingTrackedEmail(log, jobName) {
    const bQueue = (0, queue_1.getBullMailQueue)();
    const payload = log.payload;
    if (!bQueue || !payload?.link)
        return false;
    try {
        await bQueue.add(jobName, {
            emailLogId: log.id,
            toEmail: log.toEmail,
            subject: log.subject,
            link: payload.link,
            description: payload.description,
        });
        return true;
    }
    catch (err) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to re-enqueue existing email to BullMQ", {
            emailLogId: log.id,
            jobName,
            error: err?.message || String(err),
        });
        return false;
    }
}
//# sourceMappingURL=index.js.map