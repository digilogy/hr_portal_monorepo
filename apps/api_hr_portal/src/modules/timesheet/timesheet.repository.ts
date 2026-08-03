import { AppDataSource, Timesheet, TimesheetSlot, User } from "@hr-portal/database";

const timesheetOrm = AppDataSource.getRepository(Timesheet);
const userOrm = AppDataSource.getRepository(User);

export interface TimesheetHistoryOptions {
  excludeDate?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export class TimesheetRepository {
  async findUserById(userId: number): Promise<User | null> {
    return userOrm.findOneBy({ id: userId });
  }

  async findForUpdate(userId: number, date: string): Promise<Timesheet | null> {
    return timesheetOrm.findOne({
      where: { user: { id: userId }, date },
      relations: ["user"],
    });
  }

  async findByUserAndDate(userId: number, date: string): Promise<Timesheet | null> {
    return timesheetOrm.findOne({
      where: { user: { id: userId }, date },
    });
  }

  create(data: { user: User; date: string; slots: TimesheetSlot[]; totalHours: number; status: string }): Timesheet {
    return timesheetOrm.create(data);
  }

  async save(entry: Timesheet): Promise<Timesheet> {
    return timesheetOrm.save(entry);
  }

  async findHistory(userId: number, options: TimesheetHistoryOptions = {}): Promise<Timesheet[]> {
    const { excludeDate, fromDate, toDate, limit = 30 } = options;

    const query = timesheetOrm
      .createQueryBuilder("timesheet")
      .where("timesheet.userId = :userId", { userId });

    if (fromDate && toDate) {
      query
        .andWhere("timesheet.date BETWEEN :fromDate AND :toDate", {
          fromDate,
          toDate,
        })
        .orderBy("timesheet.date", "DESC");
    } else {
      query.orderBy("timesheet.date", "DESC").take(limit);

      if (excludeDate) {
        query.andWhere("timesheet.date != :excludeDate", { excludeDate });
      }
    }

    return query.getMany();
  }
}

export const timesheetRepository = new TimesheetRepository();
