import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";
export declare const s3Client: S3Client;
/**
 * Checks if S3 bucket storage is configured for runtime usage.
 */
export declare function isS3Configured(): boolean;
/**
 * Direct server-side upload of a file buffer to AWS S3.
 */
export declare function uploadBufferToS3(fileKey: string, buffer: Buffer, contentType?: string): Promise<string>;
/**
 * Retrieves a Readable stream for an S3 object.
 */
export declare function getS3FileStream(fileKey: string): Promise<Readable>;
/**
 * Generates a pre-signed URL for uploading a file directly to S3 from the client.
 */
export declare function getUploadPresignedUrl(fileKey: string, contentType: string, expiresInSeconds?: number): Promise<{
    uploadUrl: string;
    fileKey: string;
}>;
/**
 * Generates a pre-signed URL for downloading/viewing a file from S3.
 */
export declare function getDownloadPresignedUrl(fileKey: string, expiresInSeconds?: number): Promise<string>;
//# sourceMappingURL=index.d.ts.map