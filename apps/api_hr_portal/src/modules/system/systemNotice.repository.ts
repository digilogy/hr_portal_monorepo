import { AppDataSource, SystemNotice } from "@hr-portal/database";

export class SystemNoticeRepository {
  private get repo() {
    return AppDataSource.getRepository(SystemNotice);
  }

  /** The table is treated as a single row; the oldest row wins if more ever exist. */
  async get(): Promise<SystemNotice | null> {
    try {
      if (!AppDataSource.isInitialized) return null;
      return await this.repo.findOne({ where: {}, order: { id: "ASC" } });
    } catch {
      return null;
    }
  }

  async upsert(data: Partial<SystemNotice>): Promise<SystemNotice> {
    const existing = await this.get();
    if (existing) {
      this.repo.merge(existing, data);
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create(data));
  }
}

export const systemNoticeRepository = new SystemNoticeRepository();
