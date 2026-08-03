import { UploadLog } from "./UploadLog";
export declare enum UploadJobStatus {
    QUEUED = "queued",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare class UploadJob {
    id: string;
    fileName?: string;
    filePath?: string;
    status: UploadJobStatus;
    totalRows: number;
    successCount: number;
    failureCount: number;
    errorMessage?: string;
    logs: UploadLog[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=UploadJob.d.ts.map