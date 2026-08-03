import { AppDataSource, EmployeeData, Timesheet, User } from "@hr-portal/database";

const employeeDataOrm = AppDataSource.getRepository(EmployeeData);
const timesheetOrm = AppDataSource.getRepository(Timesheet);
const userOrm = AppDataSource.getRepository(User);

export interface TimesheetHoursStats {
  hours: number;
  hasEntry: boolean;
}

export interface TimesheetExportEntry {
  employee: EmployeeData;
  entry: Timesheet;
}

export class TeamReportsRepository {
  async findAllEmployees(): Promise<EmployeeData[]> {
    return employeeDataOrm.find();
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return userOrm
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
  }

  async findSignedUpUsersForEmails(emails: string[]): Promise<User[]> {
    if (emails.length === 0) return [];
    const lowerEmails = emails.map((e) => e.toLowerCase());
    return userOrm
      .createQueryBuilder("user")
      .where("LOWER(user.email) IN (:...emails)", { emails: lowerEmails })
      .getMany();
  }

  async findTimesheetsForUserInRange(
    userId: number,
    from: string,
    to: string,
  ): Promise<Timesheet[]> {
    return timesheetOrm
      .createQueryBuilder("timesheet")
      .where("timesheet.userId = :userId", { userId })
      .andWhere("timesheet.date BETWEEN :from AND :to", { from, to })
      .orderBy("timesheet.date", "ASC")
      .getMany();
  }

  async getTimesheetHoursByEmail(
    emails: string[],
    from: string,
    to: string,
  ): Promise<Map<string, TimesheetHoursStats>> {
    const normalizedEmails = emails.map((email) => email.toLowerCase());
    const result = new Map<string, TimesheetHoursStats>();

    for (const email of normalizedEmails) {
      result.set(email, { hours: 0, hasEntry: false });
    }

    if (normalizedEmails.length === 0) return result;

    const batchSize = 500;
    for (let index = 0; index < normalizedEmails.length; index += batchSize) {
      const emailBatch = normalizedEmails.slice(index, index + batchSize);
      const users = await userOrm
        .createQueryBuilder("user")
        .where("LOWER(user.email) IN (:...emails)", { emails: emailBatch })
        .getMany();

      if (users.length === 0) continue;

      const userIds = users.map((user) => user.id);
      const userIdToEmail = new Map(
        users.map((user) => [user.id, user.email.toLowerCase()]),
      );

      const aggregates = await timesheetOrm
        .createQueryBuilder("timesheet")
        .select("timesheet.userId", "userId")
        .addSelect("COALESCE(SUM(timesheet.totalHours), 0)", "hours")
        .addSelect("COUNT(timesheet.id)", "entryCount")
        .where("timesheet.userId IN (:...userIds)", { userIds })
        .andWhere("timesheet.date BETWEEN :from AND :to", { from, to })
        .groupBy("timesheet.userId")
        .getRawMany<{ userId: number; hours: string; entryCount: string }>();

      for (const row of aggregates) {
        const email = userIdToEmail.get(Number(row.userId));
        if (!email) continue;
        result.set(email, {
          hours: parseFloat(Number(row.hours).toFixed(1)),
          hasEntry: Number(row.entryCount) > 0,
        });
      }
    }

    return result;
  }

  async findTimesheetEntriesForExport(
    employees: EmployeeData[],
    from: string,
    to: string,
  ): Promise<TimesheetExportEntry[]> {
    const employeeByEmail = new Map<string, EmployeeData>();
    const normalizedEmails: string[] = [];

    for (const employee of employees) {
      const email = employee.officialEmailId?.trim().toLowerCase();
      if (!email) continue;
      employeeByEmail.set(email, employee);
      normalizedEmails.push(email);
    }

    if (normalizedEmails.length === 0) return [];

    const results: TimesheetExportEntry[] = [];
    const batchSize = 500;

    for (let index = 0; index < normalizedEmails.length; index += batchSize) {
      const emailBatch = normalizedEmails.slice(index, index + batchSize);
      const users = await userOrm
        .createQueryBuilder("user")
        .where("LOWER(user.email) IN (:...emails)", { emails: emailBatch })
        .getMany();

      if (users.length === 0) continue;

      const userIds = users.map((user) => user.id);
      const userIdToEmail = new Map(
        users.map((user) => [user.id, user.email.toLowerCase()]),
      );

      const entries = await timesheetOrm
        .createQueryBuilder("timesheet")
        .leftJoinAndSelect("timesheet.user", "user")
        .where("timesheet.userId IN (:...userIds)", { userIds })
        .andWhere("timesheet.date BETWEEN :from AND :to", { from, to })
        .orderBy("timesheet.date", "ASC")
        .getMany();

      for (const entry of entries) {
        const email = userIdToEmail.get(entry.user.id);
        if (!email) continue;
        const employee = employeeByEmail.get(email);
        if (!employee) continue;

        results.push({ employee, entry });
      }
    }

    return results;
  }

  async getWorkforcePulseData(
    emails: string[],
    from: string,
    to: string,
  ): Promise<{
    dailyRows: Array<{ date: string | Date; submittedCount: string; totalHours: string }>;
    entries: Timesheet[];
  }> {
    const normalizedEmails = emails.map((email) => email.toLowerCase()).filter(Boolean);
    if (normalizedEmails.length === 0) {
      return { dailyRows: [], entries: [] };
    }

    const dailyRowsResult: Array<{ date: string | Date; submittedCount: string; totalHours: string }> = [];
    const entriesResult: Timesheet[] = [];
    const batchSize = 500;

    for (let index = 0; index < normalizedEmails.length; index += batchSize) {
      const emailBatch = normalizedEmails.slice(index, index + batchSize);
      const users = await userOrm
        .createQueryBuilder("user")
        .where("LOWER(user.email) IN (:...emails)", { emails: emailBatch })
        .getMany();

      if (users.length === 0) continue;
      const userIds = users.map((user) => user.id);

      const dailyRows = await timesheetOrm
        .createQueryBuilder("timesheet")
        .select("timesheet.date", "date")
        .addSelect("COUNT(DISTINCT timesheet.userId)", "submittedCount")
        .addSelect("COALESCE(SUM(timesheet.totalHours), 0)", "totalHours")
        .where("timesheet.userId IN (:...userIds)", { userIds })
        .andWhere("timesheet.date BETWEEN :from AND :to", { from, to })
        .groupBy("timesheet.date")
        .getRawMany<{ date: string | Date; submittedCount: string; totalHours: string }>();

      dailyRowsResult.push(...dailyRows);

      const entries = await timesheetOrm
        .createQueryBuilder("timesheet")
        .where("timesheet.userId IN (:...userIds)", { userIds })
        .andWhere("timesheet.date BETWEEN :from AND :to", { from, to })
        .getMany();

      entriesResult.push(...entries);
    }

    return { dailyRows: dailyRowsResult, entries: entriesResult };
  }
}

export const teamReportsRepository = new TeamReportsRepository();
