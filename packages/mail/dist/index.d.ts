export interface SendPinEmailInput {
    toEmail: string;
    subject: string;
    link: string;
    description: string;
}
export declare class EmailService {
    static sendPinEmail(input: SendPinEmailInput): Promise<{
        messageId?: string;
    }>;
}
//# sourceMappingURL=index.d.ts.map