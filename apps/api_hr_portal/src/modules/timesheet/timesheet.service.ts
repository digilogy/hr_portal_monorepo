import { Timesheet, TimesheetSlot } from "@hr-portal/database";
import { validateTimesheetSlots } from "./timesheetSlots";
import { timesheetRepository, TimesheetHistoryOptions } from "./timesheet.repository";

function calculateSlotHours(timeSlot: string): number {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return 0;

  const parseTime = (timeStr: string) => {
    const [time, period] = timeStr.trim().split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (end <= start) return 0;

  return (end - start) / 60;
}

function calculateTotalHours(slots: TimesheetSlot[]): number {
  const total = slots
    .filter((slot) => slot.task.trim().length > 0)
    .reduce((sum, slot) => sum + calculateSlotHours(slot.timeSlot), 0);
  return parseFloat(total.toFixed(1));
}

export class TimesheetService {
  static async saveDay(
    userId: number,
    date: string,
    slots: TimesheetSlot[],
  ): Promise<Timesheet> {
    const user = await timesheetRepository.findUserById(userId);
    if (!user) throw new Error("User not found");

    validateTimesheetSlots(slots);

    const totalHours = calculateTotalHours(slots);
    const existing = await timesheetRepository.findForUpdate(userId, date);

    if (existing) {
      existing.slots = slots;
      existing.totalHours = totalHours;
      existing.status = "saved";
      return timesheetRepository.save(existing);
    }

    const entry = timesheetRepository.create({
      user,
      date,
      slots,
      totalHours,
      status: "saved",
    });

    return timesheetRepository.save(entry);
  }

  static async getDay(
    userId: number,
    date: string,
  ): Promise<Timesheet | null> {
    return timesheetRepository.findByUserAndDate(userId, date);
  }

  static async getHistory(
    userId: number,
    options: TimesheetHistoryOptions = {},
  ): Promise<Timesheet[]> {
    return timesheetRepository.findHistory(userId, options);
  }
}
