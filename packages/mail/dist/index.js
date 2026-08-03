"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_ses_1 = require("@aws-sdk/client-ses");
const logger_1 = require("@hr-portal/logger");
const LOG_CONTEXT = "EmailService";
function getCleanEnv(key, fallback = "") {
    const val = process.env[key] || fallback;
    return val.trim().replace(/^["']|["']$/g, "");
}
function getSesClient() {
    const awsRegion = getCleanEnv("AWS_REGION", "ap-south-2");
    const awsAccessKeyId = getCleanEnv("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = getCleanEnv("AWS_SECRET_ACCESS_KEY");
    const awsSessionToken = getCleanEnv("AWS_SESSION_TOKEN");
    const fromEmail = getCleanEnv("SES_FROM_EMAIL", getCleanEnv("AWS_SES_FROM_EMAIL", "support@digilogy.co"));
    const client = new client_ses_1.SESClient({
        region: awsRegion,
        credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
        },
    });
    return { client, fromEmail, awsRegion, awsAccessKeyId, awsSecretAccessKey };
}
function buildPinEmailHtml(link, description) {
    return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #0b1e36;">Timesheet Portal</h2>
      <p style="color: #333; font-size: 16px;">${description}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="display: inline-block; padding: 12px 24px; color: #fff; background-color: #2563eb; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Set PIN & Log In</a>
      </div>
      <p style="font-size: 12px; color: #666; text-align: center;">If you didn't request this, please safely ignore this email.</p>
    </div>
  `;
}
class EmailService {
    static async sendPinEmail(input) {
        const { client, fromEmail, awsRegion, awsAccessKeyId, awsSecretAccessKey } = getSesClient();
        if (!awsAccessKeyId || !awsSecretAccessKey) {
            logger_1.logger.error(LOG_CONTEXT, "AWS Credentials missing in environment variables (.env)", {
                hasAccessKey: !!awsAccessKeyId,
                hasSecretKey: !!awsSecretAccessKey,
                region: awsRegion,
            });
            throw new Error("AWS SES credentials missing in environment variables");
        }
        const params = {
            Destination: { ToAddresses: [input.toEmail] },
            Message: {
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data: buildPinEmailHtml(input.link, input.description),
                    },
                },
                Subject: { Charset: "UTF-8", Data: input.subject },
            },
            Source: fromEmail,
        };
        try {
            const command = new client_ses_1.SendEmailCommand(params);
            const response = await client.send(command);
            logger_1.logger.info(LOG_CONTEXT, "SES send succeeded", {
                toEmail: input.toEmail,
                subject: input.subject,
                messageId: response.MessageId,
            });
            return { messageId: response.MessageId };
        }
        catch (err) {
            logger_1.logger.error(LOG_CONTEXT, "SES send failed", {
                toEmail: input.toEmail,
                error: err.message,
                awsRegion,
                fromEmail,
            });
            throw err;
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=index.js.map