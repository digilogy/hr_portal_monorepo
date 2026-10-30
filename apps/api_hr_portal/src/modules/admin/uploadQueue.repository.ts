import crypto from "crypto";
import { AppDataSource, UploadJob, UploadJobStatus, UploadLog } from "@hr-portal/database";

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
    const job = await uploadJobOrm.findOneBy({ id: jobId });
    if (!job) return null;

    // Every failed row, in the order they were logged (Shift Detail tab, then Employee data).
    // The row payload is left out so a large failed upload stays small.
    const failedLogs = await AppDataSource.getRepository(UploadLog).find({
      select: { id: true, rowIndex: true, employeeId: true, status: true, message: true },
      where: { job: { id: jobId }, status: "failed" },
      order: { id: "ASC" },
    });
    
    job.logs = failedLogs;
    return job;
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

  async findAll(type?: any): Promise<UploadJob[]> {
    const query = uploadJobOrm.createQueryBuilder("job");
    if (type) {
      query.where("job.type = :type", { type });
    }
    query.orderBy("job.createdAt", "DESC");
    return query.getMany();
  }
}

export const uploadQueueRepository = new UploadQueueRepository();
