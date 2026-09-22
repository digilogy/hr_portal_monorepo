import dayjs from "dayjs";
import { EmployeeProfile } from "../profile/profile.service";

// --- Date/Time Utility Functions ported from frontend ---

function parseMinutes(timeStr: string): number | null {
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(" ").filter(Boolean);
  const timePart = parts[0];
  const period = parts.length === 2 ? parts[1].toUpperCase() : null;
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
}

function parseTimeSlotRange(timeSlot: string): { start: number; end: number } | null {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return null;

  const start = parseMinutes(parts[0]);
  const end = parseMinutes(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) return null;

  return { start, end };
}

export function getSlotDurationHours(timeSlot: string): number {
  const range = parseTimeSlotRange(timeSlot);
  if (!range) return 0;
  return (range.end - range.start) / 60;
}

export function parseTimeRangeHours(timeRangeStr?: string): number {
  if (!timeRangeStr) return 8.5; // fallback

  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  const ranges = timeRangeStr.split(',');
  const possibleHours = ranges.map(range => {
    const [start, end] = range.split("-").map((s) => s.trim());
    if (!start || !end) return 8.5;
    const h1 = parseTime(start);
    const h2 = parseTime(end);
    return h2 > h1 ? h2 - h1 : 8.5;
  });

  if (possibleHours.includes(8.5)) {
    return 8.5;
  }

  return possibleHours[0] || 8.5;
}

export function parseHalfDayInfo(halfDayStr?: string): { day: number; hours: number } | null {
  if (!halfDayStr) return null;
  const match = halfDayStr.match(/^([a-zA-Z]+)\s*\((.*?)(?:\s*-\s*|\s+to\s+)(.*?)\)/i);

  if (!match) return null;

  const dayStr = match[1].toLowerCase();
  const start = match[2].trim();
  const end = match[3].trim();

  const daysMap: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };

  const day = daysMap[dayStr];
  if (day === undefined) return null;

  const parseTime = (t: string) => {
    const parts = t.replace(".", ":").split(":");
    return parseInt(parts[0]) + (parseInt(parts[1]) || 0) / 60;
  };
  const h1 = parseTime(start);
  const h2 = parseTime(end);
  const hours = h2 > h1 ? h2 - h1 : 4.5;

  return { day, hours };
}

export interface WorkdayTarget {
  date: string;
  targetHours: number;
}

export function getWorkdays(
  from: dayjs.Dayjs,
  to: dayjs.Dayjs,
  weeklyOffRule?: string,
  normalHours: number = 8.5,
  halfDayInfo: { day: number; hours: number } | null = null,
  holidays: any[] = []
): WorkdayTarget[] {
  const dates: WorkdayTarget[] = [];
  let current = from.startOf("day");
  const end = to.startOf("day");

  const rule = (weeklyOffRule || "").toLowerCase();

  const isDayOff = (dayName: string, shortName: string) => {
    const regex = new RegExp(`\\b(${dayName}|${shortName})\\b`, 'i');
    return regex.test(rule);
  };

  const excludeSunday = isDayOff("sunday", "sun") || !rule; // Default to Sunday if empty
  const excludeMonday = isDayOff("monday", "mon");
  const excludeTuesday = isDayOff("tuesday", "tue");
  const excludeWednesday = isDayOff("wednesday", "wed");
  const excludeThursday = isDayOff("thursday", "thu");
  const excludeFriday = isDayOff("friday", "fri");
  const excludeSaturday = isDayOff("saturday", "sat") && !rule.includes("2nd sat");
  const excludeSecondSaturday = rule.includes("2nd sat");

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const dayOfWeek = current.day(); // 0 = Sunday, 6 = Saturday
    let isWorkday = true;

    if (dayOfWeek === 0 && excludeSunday) isWorkday = false;
    else if (dayOfWeek === 1 && excludeMonday) isWorkday = false;
    else if (dayOfWeek === 2 && excludeTuesday) isWorkday = false;
    else if (dayOfWeek === 3 && excludeWednesday) isWorkday = false;
    else if (dayOfWeek === 4 && excludeThursday) isWorkday = false;
    else if (dayOfWeek === 5 && excludeFriday) isWorkday = false;
    else if (dayOfWeek === 6) {
      if (excludeSaturday) isWorkday = false;
      else if (excludeSecondSaturday) {
        // Calculate if it's the second Saturday
        const weekOfMonth = Math.ceil(current.date() / 7);
        if (weekOfMonth === 2) isWorkday = false;
      }
    }

    if (isWorkday && holidays.length > 0) {
      const currentStr = current.format("YYYY-MM-DD");
      const isHoliday = holidays.some((h) => {
        if (h.isOptional) return false;
        const start = dayjs(h.startDate).format("YYYY-MM-DD");
        const end = dayjs(h.endDate).format("YYYY-MM-DD");
        return currentStr >= start && currentStr <= end;
      });
      if (isHoliday) isWorkday = false;
    }

    if (isWorkday) {
      let hours = normalHours;
      if (halfDayInfo && dayOfWeek === halfDayInfo.day) {
        hours = halfDayInfo.hours;
      }
      dates.push({ date: current.format("YYYY-MM-DD"), targetHours: hours });
    }
    current = current.add(1, "day");
  }

  return dates;
}

// --- Dashboard Stats Calculation ---

export function calculateDashboardStats(
  profile: EmployeeProfile | null,
  periodEntries: any[],
  periodFrom: dayjs.Dayjs,
  periodTo: dayjs.Dayjs,
  today: dayjs.Dayjs
) {
  const cappedTo = periodTo.isAfter(today) ? today : periodTo;
  const totalHours = periodEntries.reduce((sum, e) => {
    if (Array.isArray(e.slots) && e.slots.length > 0) {
      let slotsSum = 0;
      for (const slot of e.slots as any[]) {
        if (
          slot.timeSlot &&
          (slot.task?.trim() || slot.title?.trim() || (slot.taskType && slot.taskType !== "Custom"))
        ) {
          slotsSum += getSlotDurationHours(slot.timeSlot);
        }
      }
      if (slotsSum > 0) return sum + slotsSum;
    }
    return sum + (e.totalHours || 0);
  }, 0);

  const weeklyOff = profile?.weeklyOff;
  // Validate preferredTiming against allowedTimings to ignore stale database values
  let validTiming = profile?.allowedTimings;
  if (profile?.preferredTiming && profile?.allowedTimings) {
    const opts = profile.allowedTimings.split(/[\n,]+/).map((s: string) => s.trim());
    if (opts.includes(profile.preferredTiming)) {
      validTiming = profile.preferredTiming;
    }
  }
  const normalHours = parseTimeRangeHours(validTiming);
  const halfDayInfo = parseHalfDayInfo(profile?.halfDay);

  const workingDaysArray = getWorkdays(
    periodFrom,
    periodTo,
    weeklyOff,
    normalHours,
    halfDayInfo,
    profile?.upcomingHolidays || []
  );
  const elapsedWorkdaysArray = getWorkdays(
    periodFrom,
    cappedTo,
    weeklyOff,
    normalHours,
    halfDayInfo,
    profile?.upcomingHolidays || []
  );

  const workingDays = workingDaysArray.length;
  const elapsedWorkdays = elapsedWorkdaysArray.length;

  const targetTotal = workingDaysArray.reduce((sum, d) => sum + d.targetHours, 0);
  const elapsedTargetTotal = elapsedWorkdaysArray.reduce((sum, d) => sum + d.targetHours, 0);

  const avgDaily = elapsedWorkdays > 0 ? totalHours / elapsedWorkdays : 0;
  const avgTargetDaily = elapsedWorkdays > 0 ? elapsedTargetTotal / elapsedWorkdays : normalHours;

  const loggedHoursByDate = new Map(periodEntries.map((e) => [e.date, e.totalHours || 0]));
  const fullyLoggedDates = new Set(
    elapsedWorkdaysArray
      .filter((d) => (loggedHoursByDate.get(d.date) || 0) >= d.targetHours - 0.01)
      .map((d) => d.date)
  );
  const weekdayDates = elapsedWorkdaysArray.map((d) => d.date);
  const pendingCount = weekdayDates.filter((d) => !fullyLoggedDates.has(d)).length;
  const submittedWorkdays = fullyLoggedDates.size;
  const totalPercent = targetTotal > 0 ? (totalHours / targetTotal) * 100 : 0;
  const avgPercent = avgTargetDaily > 0 ? (avgDaily / avgTargetDaily) * 100 : 0;
  const submissionPercent = elapsedWorkdays > 0 ? (submittedWorkdays / elapsedWorkdays) * 100 : 0;
  const pendingPercent =
    weekdayDates.length > 0 ? ((weekdayDates.length - pendingCount) / weekdayDates.length) * 100 : 100;
    
  return {
    totalHours: parseFloat(totalHours.toFixed(4)),
    targetTotal,
    totalPercent,
    avgDaily: parseFloat(avgDaily.toFixed(4)),
    avgTargetDaily: parseFloat(avgTargetDaily.toFixed(4)),
    avgPercent,
    submittedWorkdays,
    elapsedWorkdays,
    submissionPercent,
    pendingCount,
    pendingPercent,
    needsLog: pendingCount > 0,
    normalHours,
    weekdayDates,
    elapsedWorkdaysArray,
    fullyLoggedDates: Array.from(fullyLoggedDates),
  };
}
