export declare enum EmailStatus {
    QUEUED = "queued",
    PROCESSING = "processing",
    SENT = "sent",
    FAILED = "failed"
}
export declare enum EmailType {
    PIN_SETUP = "pin_setup",
    PIN_RESET = "pin_reset"
}
export interface EmailPayload {
    link: string;
    description: string;
}
export declare class EmailLog {
    id: string;
    toEmail: string;
    subject: string;
    emailType: EmailType;
    payload?: EmailPayload;
    status: EmailStatus;
    attemptCount: number;
    maxAttempts: number;
    errorMessage?: string;
    sesMessageId?: string;
    sentAt?: Date;
    nextRetryAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=EmailLog.d.ts.map