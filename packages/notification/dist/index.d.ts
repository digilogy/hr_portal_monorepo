import { EmailLog, EmailType } from "@hr-portal/database";
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
export declare function enqueueTrackedEmail(input: EnqueueTrackedEmailInput): Promise<EnqueueTrackedEmailResult>;
/**
 * Re-enqueues an existing tracked EmailLog row (recovery / manual retry) to
 * the shared BullMQ mail queue. Returns false when there's no queue
 * connection or the log has no payload link, so callers can fall back.
 */
export declare function enqueueExistingTrackedEmail(log: EmailLog, jobName: string): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map