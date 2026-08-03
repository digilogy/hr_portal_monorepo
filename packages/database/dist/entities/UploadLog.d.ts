import { UploadJob } from "./UploadJob";
export declare class UploadLog {
    id: number;
    job: UploadJob;
    rowIndex?: number;
    employeeId?: string;
    status: string;
    message?: string;
    payload?: Record<string, any>;
    createdAt: Date;
}
//# sourceMappingURL=UploadLog.d.ts.map