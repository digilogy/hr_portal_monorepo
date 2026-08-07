import dotenv from "dotenv";
dotenv.config();

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "@hr-portal/logger";

const LOG_CONTEXT = "EmailService";

function getCleanEnv(key: string, fallback: string = ""): string {
  const val = process.env[key] || fallback;
  return val.trim().replace(/^["']|["']$/g, "");
}

function getSesClient(): { client: SESClient; fromEmail: string; awsRegion: string; awsAccessKeyId: string; awsSecretAccessKey: string } {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    dotenv.config({ override: true });
  }

  const awsRegion = getCleanEnv("AWS_REGION", "ap-south-2");
  const awsAccessKeyId = getCleanEnv("AWS_ACCESS_KEY_ID");
  const awsSecretAccessKey = getCleanEnv("AWS_SECRET_ACCESS_KEY");
  const awsSessionToken = getCleanEnv("AWS_SESSION_TOKEN");
  const fromEmail = getCleanEnv("SES_FROM_EMAIL", getCleanEnv("AWS_SES_FROM_EMAIL", "support@digilogy.co"));

  const client = new SESClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
    },
  });

  return { client, fromEmail, awsRegion, awsAccessKeyId, awsSecretAccessKey };
}

function buildPinEmailHtml(link: string, description: string): string {
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

export interface SendPinEmailInput {
  toEmail: string;
  subject: string;
  link: string;
  description: string;
}

export class EmailService {
  static async sendPinEmail(input: SendPinEmailInput): Promise<{ messageId?: string }> {
    const { client, fromEmail, awsRegion, awsAccessKeyId, awsSecretAccessKey } = getSesClient();

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      logger.error(LOG_CONTEXT, "AWS Credentials missing in environment variables (.env)", {
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
      const command = new SendEmailCommand(params);
      const response = await client.send(command);

      logger.info(LOG_CONTEXT, "SES send succeeded", {
        toEmail: input.toEmail,
        subject: input.subject,
        messageId: response.MessageId,
      });

      return { messageId: response.MessageId };
    } catch (err: any) {
      logger.error(LOG_CONTEXT, "SES send failed", {
        toEmail: input.toEmail,
        error: err.message,
        awsRegion,
        fromEmail,
      });
      throw err;
    }
  }
}
