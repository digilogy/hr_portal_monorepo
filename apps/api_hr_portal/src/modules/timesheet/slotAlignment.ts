import { TimesheetSlot } from "@hr-portal/database";
import { parseTimeSlotRange } from "./timesheetSlots";

/**
 * Re-aligns saved timesheet entries onto the slot grid of the user's current shift.
 *
 * Mirrors apps/hr_portal/src/lib/timesheetSlots.ts (alignSlotsToGrid) and the grid
 * building in apps/hr_portal/src/app/timesheet/page.tsx — keep them in sync so the
 * database and the timesheet page agree on which slot an entry belongs to.
 */

/** Grid used when the user has no shift timing (same as the page's DEFAULT_TIME_SLOTS). */
const DEFAULT_GRID = [
  "08:30 - 09:30",
  "09:30 - 10:30",
  "10:30 - 11:30",
  "11:30 - 12:30",
  "12:30 - 13:15",
  "13:15 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
];

const DAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

export function generateSlotKey(timeSlot: string): string {
  return "slot-" + timeSlot.replace(/[^0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** The timing the timesheet page uses: preferred if still allowed, else the first allowed option. */
export function resolveBaseTiming(allowedTimings?: string | null, preferredTiming?: string | null): string {
  if (!allowedTimings) return "";
  const options = allowedTimings.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  if (preferredTiming && options.includes(preferredTiming)) return preferredTiming;
  return options[0] ?? "";
}

/** Swaps in the half-day timing (e.g. "Sat (08:00 - 12:30)") on that weekday. */
export function getEffectiveTiming(date: string, halfDay: string | null | undefined, baseTiming: string): string {
  if (!halfDay) return baseTiming;
  const match = halfDay.match(/^([a-zA-Z]+)\s*\((.*?)(?:\s*-\s*|\s+to\s+)(.*?)\)/i);
  if (!match) return baseTiming;

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (DAY_INDEX[match[1].toLowerCase()] === weekday) {
    return `${match[2].trim()} - ${match[3].trim()}`;
  }
  return baseTiming;
}

/** Hourly slots from shift start to end, the last one shortened to fit. */
export function buildSlotGrid(timing: string): string[] {
  if (!timing) return DEFAULT_GRID;
  const parts = (timing.includes(" to ") ? timing.split(" to ") : timing.split("-")).map((p) => p.trim());
  if (parts.length !== 2) return DEFAULT_GRID;

  const parseTime = (t: string) => {
    const p = t.replace(".", ":").split(":");
    return parseInt(p[0]) + (parseInt(p[1]) || 0) / 60;
  };
  const formatTime = (h: number) => {
    const hr = Math.floor(h) % 24;
    const min = Math.round((h - Math.floor(h)) * 60);
    return `${hr.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  };

  const start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (Number.isNaN(start) || Number.isNaN(end)) return DEFAULT_GRID;
  if (end <= start) end += 24;

  const grid: string[] = [];
  for (let current = start; current < end; current += 1) {
    grid.push(`${formatTime(current)} - ${formatTime(Math.min(current + 1, end))}`);
  }
  return grid.length > 0 ? grid : DEFAULT_GRID;
}

/**
 * Picks the grid slot an entry belongs to: largest overlap; on a tie, the slot containing the
 * entry's start; with no overlap at all, the nearest slot. Returns -1 if nothing is parseable.
 */
function pickGridIndex(entry: { start: number; end: number }, grid: Array<{ start: number; end: number } | null>): number {
  let best = -1;
  let bestOverlap = 0;
  let bestHasStart = false;

  grid.forEach((slot, index) => {
    if (!slot) return;
    const overlap = Math.min(entry.end, slot.end) - Math.max(entry.start, slot.start);
    if (overlap <= 0) return;
    const hasStart = slot.start <= entry.start && entry.start < slot.end;
    if (overlap > bestOverlap || (overlap === bestOverlap && hasStart && !bestHasStart)) {
      best = index;
      bestOverlap = overlap;
      bestHasStart = hasStart;
    }
  });
  if (best !== -1) return best;

  let bestGap = Infinity;
  grid.forEach((slot, index) => {
    if (!slot) return;
    const gap = entry.start >= slot.end ? entry.start - slot.end : slot.start - entry.end;
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

function hasContent(slot: TimesheetSlot): boolean {
  return !!(slot.task?.trim() || slot.title?.trim());
}

/**
 * Moves every entry whose time isn't on the grid into a grid slot. Entries landing in the same
 * slot are joined with " | " in time order. Returns null when nothing needs to move.
 */
export function alignSlotsToGrid(slots: TimesheetSlot[], grid: string[]): TimesheetSlot[] | null {
  const gridSet = new Set(grid);
  const filled = (slots || []).filter(hasContent);
  if (filled.every((slot) => gridSet.has(slot.timeSlot?.trim()))) return null;

  const gridRanges = grid.map((g) => parseTimeSlotRange(g));
  const buckets = new Map<number, Array<{ start: number; slot: TimesheetSlot }>>();
  const unplaced: TimesheetSlot[] = [];

  for (const slot of filled) {
    const timeSlot = slot.timeSlot?.trim() ?? "";
    const exact = grid.indexOf(timeSlot);
    const range = parseTimeSlotRange(timeSlot);
    const index = exact !== -1 ? exact : range ? pickGridIndex(range, gridRanges) : -1;

    if (index === -1) {
      unplaced.push(slot); // unparseable time: keep untouched rather than guess
      continue;
    }
    const bucket = buckets.get(index) ?? [];
    bucket.push({ start: range?.start ?? 0, slot });
    buckets.set(index, bucket);
  }

  const aligned: TimesheetSlot[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, bucket]) => {
      const entries = bucket.sort((a, b) => a.start - b.start).map((b) => b.slot);
      const join = (values: Array<string | undefined>) =>
        values.map((v) => v?.trim()).filter(Boolean).join(" | ");
      const merged: TimesheetSlot = {
        key: generateSlotKey(grid[index]),
        timeSlot: grid[index],
        title: join(entries.map((e) => e.title)),
        task: join(entries.map((e) => e.task)),
      };
      const taskType = entries.find((e) => e.taskType)?.taskType;
      if (taskType) merged.taskType = taskType;
      return merged;
    });

  return [...aligned, ...unplaced];
}
