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
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        dotenv_1.default.config({ override: true });
    }
    const awsRegion = getCleanEnv("AWS_REGION", getCleanEnv("AWS_DEFAULT_REGION", "ap-south-1"));
    const awsAccessKeyId = getCleanEnv("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = getCleanEnv("AWS_SECRET_ACCESS_KEY");
    const awsSessionToken = getCleanEnv("AWS_SESSION_TOKEN");
    const fromEmail = getCleanEnv("SES_FROM_EMAIL", getCleanEnv("AWS_SES_FROM_EMAIL", "support@cgworkflow.com"));
    const hasExplicitCredentials = !!(awsAccessKeyId && awsSecretAccessKey);
    // If explicit keys exist, use them. Otherwise, let AWS SDK resolve via IAM Task Role / Container / ECS credentials.
    const client = new client_ses_1.SESClient({
        region: awsRegion,
        ...(hasExplicitCredentials
            ? {
                credentials: {
                    accessKeyId: awsAccessKeyId,
                    secretAccessKey: awsSecretAccessKey,
                    ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
                },
            }
            : {}),
    });
    return { client, fromEmail, awsRegion, hasExplicitCredentials };
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
        const { client, fromEmail, awsRegion, hasExplicitCredentials } = getSesClient();
        const isProduction = process.env.NODE_ENV === "production";
        // In local development, if no AWS credentials are configured, log the PIN email link directly for convenience
        const isEcsOrAws = !!(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI || process.env.AWS_EXECUTION_ENV);
        if (!hasExplicitCredentials && !isProduction && !isEcsOrAws) {
            logger_1.logger.info(LOG_CONTEXT, `[LOCAL DEV EMAIL FALLBACK] Email to ${input.toEmail}: ${input.link}`, {
                toEmail: input.toEmail,
                subject: input.subject,
                link: input.link,
            });
            return { messageId: `mock-dev-${Date.now()}` };
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
            if (!isProduction) {
                logger_1.logger.warn(LOG_CONTEXT, `SES send failed in non-production. Falling back to console log: ${input.link}`, {
                    error: err.message,
                    toEmail: input.toEmail,
                });
                return { messageId: `mock-dev-fallback-${Date.now()}` };
            }
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