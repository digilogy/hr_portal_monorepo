import crypto from "crypto";
import { AppDataSource, UploadJob, UploadJobStatus } from "@hr-portal/database";

const uploadJobOrm = AppDataSource.getRepository(UploadJob);

export interface UploadJobCreateInput {
  fileName: string;
  filePath: string;
  status: UploadJobStatus;
  type?: any;
  totalRows: number;
  successCount: number;
  failureCount: number;
}

export class UploadQueueRepository {
  async findById(jobId: string): Promise<UploadJob | null> {
    return uploadJobOrm.findOneBy({ id: jobId });
  }

  async findByIdWithLogs(jobId: string): Promise<UploadJob | null> {
    return uploadJobOrm.findOne({
      where: { id: jobId },
      relations: ["logs"],
    });
  }

  create(data: UploadJobCreateInput): UploadJob {
    const job = uploadJobOrm.create(data);
    if (!job.id) {
      job.id = crypto.randomUUID();
    }
    const now = new Date();
    job.createdAt = now;
    job.updatedAt = now;
    return job;
  }

  async save(job: UploadJob): Promise<UploadJob> {
    job.updatedAt = new Date();
    return uploadJobOrm.save(job);
  }
}

export const uploadQueueRepository = new UploadQueueRepository();
