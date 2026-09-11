import { Queue } from "bullmq";
export declare const MAIL_QUEUE_NAME = "mail-queue";
export declare const QUEUE_PREFIX = "{bull}";
export interface MailJobPayload {
    emailLogId: string;
    toEmail: string;
    subject: string;
    link: string;
    description: string;
}
export declare function getBullMailQueue(): Queue<MailJobPayload> | null;
//# sourceMappingURL=mail-queue.d.ts.map