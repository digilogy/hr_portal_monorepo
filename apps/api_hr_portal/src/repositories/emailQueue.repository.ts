import { AppDataSource, EmailLog, EmailStatus } from "@hr-portal/database";

const emailLogOrm = AppDataSource.getRepository(EmailLog);

export interface EmailLogCreateInput {
  toEmail: string;
  subject: string;
  emailType: EmailLog["emailType"];
  payload: EmailLog["payload"];
  status: EmailStatus;
  attemptCount: number;
  maxAttempts: number;
}

export interface ListEmailLogsOptions {
  toEmail?: string;
  status?: EmailStatus;
  limit?: number;
  offset?: number;
}

export class EmailQueueRepository {
  create(data: EmailLogCreateInput): EmailLog {
    return emailLogOrm.create(data);
  }

  async save(log: EmailLog): Promise<EmailLog> {
    return emailLogOrm.save(log);
  }

  async findById(emailLogId: string): Promise<EmailLog | null> {
    return emailLogOrm.findOneBy({ id: emailLogId });
  }

  async findPending(): Promise<EmailLog[]> {
    return emailLogOrm.find({
      where: [{ status: EmailStatus.QUEUED }, { status: EmailStatus.PROCESSING }],
      order: { createdAt: "ASC" },
    });
  }

  async findLogs(options: ListEmailLogsOptions): Promise<{ items: EmailLog[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const qb = emailLogOrm
      .createQueryBuilder("email")
      .orderBy("email.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (options.toEmail) {
      qb.andWhere("email.toEmail = :toEmail", { toEmail: options.toEmail });
    }

    if (options.status) {
      qb.andWhere("email.status = :status", { status: options.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}

export const emailQueueRepository = new EmailQueueRepository();
