import { Timesheet, TimesheetSlot } from "@hr-portal/database";
import { validateTimesheetSlots } from "./timesheetSlots";
import { timesheetRepository, TimesheetHistoryOptions } from "./timesheet.repository";
import { ProfileService, EmployeeProfile } from "../profile/profile.service";

function calculateSlotHours(timeSlot: string): number {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return 0;

  const parseMinutes = (timeStr: string): number | null => {
    const trimmed = timeStr.trim();
    if (!trimmed) return null;

    const tokens = trimmed.split(" ").filter(Boolean);
    const timePart = tokens[0];
    const period = tokens.length === 2 ? tokens[1].toUpperCase() : null;
    const [hStr, mStr] = timePart.split(":");
    if (!hStr || !mStr) return null;

    const hour = Number(hStr);
    const minute = Number(mStr);
    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) {
      return null;
    }

    let normalizedHour = hour;
    if (period) {
      if (period !== "AM" && period !== "PM") return null;
      if (normalizedHour < 1 || normalizedHour > 12) return null;
      if (period === "PM" && normalizedHour !== 12) normalizedHour += 12;
      if (period === "AM" && normalizedHour === 12) normalizedHour = 0;
    } else {
      if (normalizedHour < 0 || normalizedHour > 23) return null;
    }

    return normalizedHour * 60 + minute;
  };

  const start = parseMinutes(parts[0]);
  const end = parseMinutes(parts[1]);
  if (start === null || end === null || end <= start) return 0;

  return (end - start) / 60;
}

function calculateTotalHours(slots: TimesheetSlot[]): number {
  const total = slots
    .filter((slot) => {
      if (!slot.timeSlot || !slot.timeSlot.trim()) return false;
      return !!(
        slot.task?.trim() ||
        slot.title?.trim() ||
        (slot.taskType && slot.taskType !== "Custom")
      );
    })
    .reduce((sum, slot) => sum + calculateSlotHours(slot.timeSlot), 0);
  return parseFloat(total.toFixed(1));
}

export class TimesheetService {
  static isNonWorkingDay(dateStr: string, profile: EmployeeProfile): boolean {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
    
    if (profile.weeklyOff) {
      const offDaysMap: Record<string, number> = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
      };
      
      const offDays = profile.weeklyOff.split(",").map(d => d.trim().toLowerCase());
      for (const off of offDays) {
        if (offDaysMap[off] === dayOfWeek) {
          return true;
        }
        
        const nthMatch = off.match(/^(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(.+)$/);
        if (nthMatch) {
          const nthMap: Record<string, number> = { 
            first: 1, '1st': 1, 
            second: 2, '2nd': 2, 
            third: 3, '3rd': 3, 
            fourth: 4, '4th': 4, 
            fifth: 5, '5th': 5 
          };
          const n = nthMap[nthMatch[1]];
          const targetDay = offDaysMap[nthMatch[2]];
          if (n && targetDay !== undefined) {
             const dateNum = date.getDate();
             const currentNth = Math.ceil(dateNum / 7);
             if (dayOfWeek === targetDay && currentNth === n) {
               return true;
             }
          }
        }
      }
    }

    if (profile.upcomingHolidays && profile.upcomingHolidays.length > 0) {
      const holiday = profile.upcomingHolidays.find((h: any) => {
        if (h.isOptional) return false;
        
        // Convert Date objects to YYYY-MM-DD strings for comparison
        const formatYMD = (d: Date | string) => {
          const dt = new Date(d);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        };
        
        const start = formatYMD(h.startDate);
        const end = formatYMD(h.endDate);
        return dateStr >= start && dateStr <= end;
      });
      if (holiday) {
        return true;
      }
    }

    return false;
  }

  static async saveDay(
    userId: number,
    date: string,
    slots: TimesheetSlot[],
  ): Promise<Timesheet> {
    const user = await timesheetRepository.findUserById(userId);
    if (!user) throw new Error("User not found");

    const [year, month, day] = date.split("-").map(Number);
    const inputDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    if (inputDate > today) {
      throw new Error("Cannot save timesheets for future dates");
    }

    // Block non-working days
    const profile = await ProfileService.getProfileByEmail(user.email);
    if (profile && this.isNonWorkingDay(date, profile)) {
      throw new Error("Cannot log time on a non-working day (weekend or public holiday).");
    }

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
