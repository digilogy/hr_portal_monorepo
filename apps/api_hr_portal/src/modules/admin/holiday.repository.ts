import { AppDataSource, Holiday } from "@hr-portal/database";

const holidayOrm = AppDataSource.getRepository(Holiday);

export class HolidayRepository {
  async findAll(): Promise<Holiday[]> {
    return holidayOrm.find({
      order: { startDate: "ASC" },
    });
  }

  async findById(id: number): Promise<Holiday | null> {
    return holidayOrm.findOneBy({ id });
  }

  async create(data: Partial<Holiday>): Promise<Holiday> {
    const holiday = holidayOrm.create(data);
    return holidayOrm.save(holiday);
  }

  async update(id: number, data: Partial<Holiday>): Promise<Holiday | null> {
    await holidayOrm.update(id, data);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await holidayOrm.delete(id);
  }
}

export const holidayRepository = new HolidayRepository();
