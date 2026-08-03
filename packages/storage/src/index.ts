import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@hr-portal/config";
import { logger } from "@hr-portal/logger";

const LOG_CONTEXT = "Storage";

const s3Config: ConstructorParameters<typeof S3Client>[0] = {
  region: env.AWS_REGION ?? env.AWS_DEFAULT_REGION,
};

if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  };
} else {
  logger.warn(LOG_CONTEXT, "AWS credentials missing. Storage SDK is running in unauthenticated mode (e.g. local IAM role).");
}

export const s3Client = new S3Client(s3Config);

/**
 * Generates a pre-signed URL for uploading a file directly to S3 from the client.
 */
export async function getUploadPresignedUrl(
  fileKey: string,
  contentType: string,
  expiresInSeconds = 900, // 15 mins default
): Promise<{ uploadUrl: string; fileKey: string }> {
  try {
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return { uploadUrl, fileKey };
  } catch (error) {
    logger.error(LOG_CONTEXT, "Failed to generate upload pre-signed URL", { fileKey, error });
    throw error;
  }
}

/**
 * Generates a pre-signed URL for downloading/viewing a file from S3.
 */
export async function getDownloadPresignedUrl(
  fileKey: string,
  expiresInSeconds = 3600, // 1 hour default
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: fileKey,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (error) {
    logger.error(LOG_CONTEXT, "Failed to generate download pre-signed URL", { fileKey, error });
    throw error;
  }
}
