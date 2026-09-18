"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Client = void 0;
exports.isS3Configured = isS3Configured;
exports.uploadBufferToS3 = uploadBufferToS3;
exports.getS3FileStream = getS3FileStream;
exports.getUploadPresignedUrl = getUploadPresignedUrl;
exports.getDownloadPresignedUrl = getDownloadPresignedUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = require("@hr-portal/config");
const logger_1 = require("@hr-portal/logger");
const LOG_CONTEXT = "Storage";
const s3Config = {
    region: config_1.env.AWS_REGION ?? config_1.env.AWS_DEFAULT_REGION,
};
if (config_1.env.AWS_ACCESS_KEY_ID && config_1.env.AWS_SECRET_ACCESS_KEY) {
    s3Config.credentials = {
        accessKeyId: config_1.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: config_1.env.AWS_SECRET_ACCESS_KEY,
    };
}
else {
    logger_1.logger.warn(LOG_CONTEXT, "AWS credentials missing. Storage SDK is running in unauthenticated mode (e.g. local IAM role).");
}
exports.s3Client = new client_s3_1.S3Client(s3Config);
/**
 * Checks if S3 bucket storage is configured for runtime usage.
 */
function isS3Configured() {
    return Boolean(config_1.env.AWS_S3_BUCKET && config_1.env.AWS_S3_BUCKET.trim() !== "");
}
/**
 * Direct server-side upload of a file buffer to AWS S3.
 */
async function uploadBufferToS3(fileKey, buffer, contentType) {
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: config_1.env.AWS_S3_BUCKET,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType || "application/octet-stream",
        });
        await exports.s3Client.send(command);
        logger_1.logger.info(LOG_CONTEXT, "Successfully uploaded file buffer to S3", {
            fileKey,
            bucket: config_1.env.AWS_S3_BUCKET,
        });
        return `s3://${fileKey}`;
    }
    catch (error) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to upload buffer to S3", { fileKey, error });
        throw error;
    }
}
/**
 * Retrieves a Readable stream for an S3 object.
 */
async function getS3FileStream(fileKey) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: config_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        const response = await exports.s3Client.send(command);
        if (!response.Body) {
            throw new Error("Empty body received from S3 Object");
        }
        return response.Body;
    }
    catch (error) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to retrieve S3 file stream", { fileKey, error });
        throw error;
    }
}
/**
 * Generates a pre-signed URL for uploading a file directly to S3 from the client.
 */
async function getUploadPresignedUrl(fileKey, contentType, expiresInSeconds = 900) {
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: config_1.env.AWS_S3_BUCKET,
            Key: fileKey,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn: expiresInSeconds });
        return { uploadUrl, fileKey };
    }
    catch (error) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to generate upload pre-signed URL", { fileKey, error });
        throw error;
    }
}
/**
 * Generates a pre-signed URL for downloading/viewing a file from S3.
 */
async function getDownloadPresignedUrl(fileKey, expiresInSeconds = 3600) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: config_1.env.AWS_S3_BUCKET,
            Key: fileKey,
        });
        return await (0, s3_request_presigner_1.getSignedUrl)(exports.s3Client, command, { expiresIn: expiresInSeconds });
    }
    catch (error) {
        logger_1.logger.error(LOG_CONTEXT, "Failed to generate download pre-signed URL", { fileKey, error });
        throw error;
    }
}
//# sourceMappingURL=index.js.map