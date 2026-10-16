import {
  AppDataSource,
  EmployeeData,
  EmployeeShiftAssignment,
  Timesheet,
  TimesheetSlot,
  User,
} from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { In, MoreThan, MoreThanOrEqual } from "typeorm";
import {
  alignSlotsToGrid,
  buildSlotGrid,
  getEffectiveTiming,
  resolveBaseTiming,
} from "../modules/timesheet/slotAlignment";
import { calculateTotalHours, TimesheetService } from "../modules/timesheet/timesheet.service";
import { ProfileService } from "../modules/profile/profile.service";

const LOG_CONTEXT = "TimesheetRealign";
const BATCH_SIZE = 500;
/** Editable days are today plus two working days back; this many calendar days covers off days and holidays. */
const LOOKBACK_DAYS = 14;

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Today in IST, the latest timezone the portal serves, so no user's "today" is ever ahead of it. */
function todayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export interface RealignOptions {
  /** Limit to these employees; all users when omitted. */
  employeeIds?: string[];
  /** Count what would change without writing anything. */
  dryRun?: boolean;
}

export interface RealignSummary {
  scanned: number;
  changed: number;
  usersAffected: number;
}

interface UserShift {
  baseTiming: string;
  halfDay?: string;
}

/**
 * Moves saved timesheet entries onto the slot grid of each user's current shift, so a shift
 * change doesn't leave old and new slots overlapping.
 *
 * Only days the user can still edit (today and the previous two working days, matching the
 * timesheet page) are touched. Older days were logged under the shift that applied then, and
 * rewriting them would change historical hours in reports.
 *
 * The first time a day is changed, its original slots are kept in `originalSlots` so the
 * rewrite can be undone with `restore`.
 */
export class TimesheetRealignService {
  private static running: Promise<RealignSummary> | null = null;
  private static rerunRequested = false;

  /** Today plus the previous two working days for this user, as YYYY-MM-DD. */
  private static async getEditableDates(email: string, today: string): Promise<Set<string>> {
    const profile = await ProfileService.getProfileByEmail(email).catch(() => null);
    const isOff = (date: string) => (profile ? TimesheetService.isNonWorkingDay(date, profile) : false);

    const dates = new Set([today]);
    let date = today;
    for (let found = 0, guard = 0; found < 2 && guard < 30; guard++) {
      date = addDays(date, -1);
      if (!isOff(date)) {
        dates.add(date);
        found++;
      }
    }
    return dates;
  }

  /** Map of userId -> current shift timing, built the same way the profile resolves it. */
  private static async loadUserShifts(employeeIds?: string[]): Promise<Map<number, UserShift>> {
    const assignments = await AppDataSource.getRepository(EmployeeShiftAssignment).find({
      where: employeeIds ? { employeeId: In(employeeIds) } : {},
      relations: ["shift"],
    });
    const shiftByEmployee = new Map<string, UserShift>();
    for (const a of assignments) {
      shiftByEmployee.set(a.employeeId.trim(), {
        baseTiming: resolveBaseTiming(a.shift?.allowedTimings, a.preferredTiming),
        halfDay: a.shift?.halfDay || undefined,
      });
    }

    const employees = await AppDataSource.getRepository(EmployeeData).find({
      where: employeeIds ? { employeeId: In(employeeIds) } : {},
      select: ["employeeId", "officialEmailId"],
    });
    const employeeIdByEmail = new Map<string, string>();
    for (const e of employees) {
      const email = e.officialEmailId?.trim().toLowerCase();
      const id = e.employeeId?.trim();
      if (email && id) employeeIdByEmail.set(email, id);
    }

    const users = await AppDataSource.getRepository(User).find({ select: ["id", "email"] });
    const result = new Map<number, UserShift>();
    for (const user of users) {
      const employeeId = employeeIdByEmail.get(user.email.trim().toLowerCase());
      if (employeeIds && !employeeId) continue; // not one of the requested employees
      // No assignment means the page falls back to its default grid; mirror that.
      result.set(user.id, (employeeId && shiftByEmployee.get(employeeId)) || { baseTiming: "" });
    }
    return result;
  }

  private static async run(options: RealignOptions): Promise<RealignSummary> {
    const userShifts = await this.loadUserShifts(options.employeeIds);
    const summary: RealignSummary = { scanned: 0, changed: 0, usersAffected: 0 };
    if (userShifts.size === 0) return summary;

    const repo = AppDataSource.getRepository(Timesheet);
    const affectedUsers = new Set<number>();
    const userIds = [...userShifts.keys()];
    const today = todayDateString();
    const editableByUser = new Map<number, Set<string>>();
    let lastId = 0;

    for (;;) {
      const batch = await repo.find({
        where: {
          id: MoreThan(lastId),
          date: MoreThanOrEqual(addDays(today, -LOOKBACK_DAYS)),
          ...(options.employeeIds ? { user: { id: In(userIds) } } : {}),
        },
        relations: ["user"],
        order: { id: "ASC" },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      lastId = batch[batch.length - 1].id;

      for (const entry of batch) {
        summary.scanned++;
        const shift = userShifts.get(entry.user.id);
        if (!shift) continue;

        let editable = editableByUser.get(entry.user.id);
        if (!editable) {
          editable = await this.getEditableDates(entry.user.email, today);
          editableByUser.set(entry.user.id, editable);
        }
        if (!editable.has(entry.date)) continue;

        const grid = buildSlotGrid(getEffectiveTiming(entry.date, shift.halfDay, shift.baseTiming));
        const aligned = alignSlotsToGrid(entry.slots as TimesheetSlot[], grid);
        if (!aligned) continue;

        summary.changed++;
        affectedUsers.add(entry.user.id);
        if (options.dryRun) continue;

        await repo.update(entry.id, {
          slots: aligned,
          totalHours: calculateTotalHours(aligned),
          // Keep the very first version; later re-alignments must not overwrite it.
          ...(entry.originalSlots ? {} : { originalSlots: entry.slots }),
        } as Partial<Timesheet>);
      }
    }

    if (!options.dryRun) {
      for (const userId of affectedUsers) {
        await TimesheetService.invalidateHistoryCache(userId);
      }
    }
    summary.usersAffected = affectedUsers.size;
    return summary;
  }

  static async realign(options: RealignOptions = {}): Promise<RealignSummary> {
    const summary = await this.run(options);
    logger.info(LOG_CONTEXT, options.dryRun ? "Dry run complete" : "Realign complete", {
      ...summary,
      employeeIds: options.employeeIds?.length,
    });
    return summary;
  }

  /**
   * Fire-and-forget full realign, used after HR uploads. Runs one at a time; a request that
   * arrives mid-run triggers exactly one more pass so the latest shift data is always applied.
   */
  static realignAllInBackground(reason: string): void {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    logger.info(LOG_CONTEXT, "Starting background realign", { reason });
    this.running = this.realign()
      .catch((error: unknown) => {
        logger.error(LOG_CONTEXT, "Background realign failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
        return { scanned: 0, changed: 0, usersAffected: 0 };
      })
      .finally(() => {
        this.running = null;
        if (this.rerunRequested) {
          this.rerunRequested = false;
          this.realignAllInBackground(`${reason} (rerun)`);
        }
      });
  }

  /** Puts every re-aligned day back to its original slots and clears the backup. */
  static async restore(): Promise<number> {
    const result = await AppDataSource.query(`
      UPDATE "timesheet"
      SET "slots" = "originalSlots", "originalSlots" = NULL
      WHERE "originalSlots" IS NOT NULL
      RETURNING "id", "userId", "slots"
    `);
    const rows: Array<{ id: number; userId: number; slots: TimesheetSlot[] }> = result[0] ?? [];
    const repo = AppDataSource.getRepository(Timesheet);
    for (const row of rows) {
      await repo.update(row.id, { totalHours: calculateTotalHours(row.slots) });
    }
    for (const userId of new Set(rows.map((r) => r.userId))) {
      await TimesheetService.invalidateHistoryCache(userId);
    }
    logger.info(LOG_CONTEXT, "Restore complete", { restored: rows.length });
    return rows.length;
  }
}
