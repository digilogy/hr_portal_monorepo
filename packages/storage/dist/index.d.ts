import { S3Client } from "@aws-sdk/client-s3";
export declare const s3Client: S3Client;
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