import { UploadLog } from "./UploadLog";
export declare enum UploadJobStatus {
    QUEUED = "queued",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum UploadJobType {
    EMPLOYEE = "employee",
    SHIFT = "shift",
    MASTER = "master"
}
export declare class UploadJob {
    id: string;
    fileName?: string;
    filePath?: string;
    status: UploadJobStatus;
    type: UploadJobType;
    totalRows: number;
    successCount: number;
    failureCount: number;
    processed: number;
    errorMessage?: string;
    logs: UploadLog[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=UploadJob.d.ts.map