import { AppDataSource, SystemNotice } from "@hr-portal/database";

const noticeOrm = AppDataSource.getRepository(SystemNotice);

export class SystemNoticeRepository {
  /** The table is treated as a single row; the oldest row wins if more ever exist. */
  async get(): Promise<SystemNotice | null> {
    return noticeOrm.findOne({ where: {}, order: { id: "ASC" } });
  }

  async upsert(data: Partial<SystemNotice>): Promise<SystemNotice> {
    const existing = await this.get();
    if (existing) {
      noticeOrm.merge(existing, data);
      return noticeOrm.save(existing);
    }
    return noticeOrm.save(noticeOrm.create(data));
  }
}

export const systemNoticeRepository = new SystemNoticeRepository();
