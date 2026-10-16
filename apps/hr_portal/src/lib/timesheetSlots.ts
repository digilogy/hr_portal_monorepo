export interface TimeSlotLike {
  key?: string;
  timeSlot: string;
}

interface ParsedTimeRange {
  start: number;
  end: number;
}

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

export function parseTimeSlotRange(timeSlot: string): ParsedTimeRange | null {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return null;

  const start = parseMinutes(parts[0]);
  const end = parseMinutes(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) return null;

  return { start, end };
}

function isInvalidTimeOrder(timeSlot: string): boolean {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return true;

  const start = parseMinutes(parts[0]);
  const end = parseMinutes(parts[1]);
  if (start === null || end === null) return true;

  return end <= start;
}

function normalizeTimeSlot(timeSlot: string): string {
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return timeSlot.trim().toLowerCase();
  return `${parts[0].trim().toLowerCase()} - ${parts[1].trim().toLowerCase()}`;
}

function rangesOverlap(a: ParsedTimeRange, b: ParsedTimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findSlotTimeConflict(
  slots: TimeSlotLike[],
  candidateTimeSlot: string,
  excludeKey?: string,
): string | null {
  if (isInvalidTimeOrder(candidateTimeSlot)) {
    return "End time must be after start time on the same day.";
  }

  const candidate = parseTimeSlotRange(candidateTimeSlot);
  if (!candidate) return "Invalid time slot.";

  const candidateNorm = normalizeTimeSlot(candidateTimeSlot);

  for (const slot of slots) {
    if (excludeKey && slot.key === excludeKey) continue;
    if (!slot.timeSlot?.trim()) continue;

    const existing = parseTimeSlotRange(slot.timeSlot);
    if (!existing) continue;

    if (normalizeTimeSlot(slot.timeSlot) === candidateNorm) {
      return "This time slot already has a task logged.";
    }

    if (rangesOverlap(candidate, existing)) {
      return `This time overlaps with an existing slot (${slot.timeSlot}).`;
    }
  }

  return null;
}

export function getLatestSlotEndMinutes(slots: TimeSlotLike[]): number | null {
  let maxEnd: number | null = null;
  for (const slot of slots) {
    const range = parseTimeSlotRange(slot.timeSlot);
    if (!range) continue;
    if (maxEnd === null || range.end > maxEnd) maxEnd = range.end;
  }
  return maxEnd;
}

export function getSlotDurationHours(timeSlot: string): number {
  const range = parseTimeSlotRange(timeSlot);
  if (!range) return 0;
  return (range.end - range.start) / 60;
}

export function normalizeTimeSlotRange(timeSlot: string): string {
  const range = parseTimeSlotRange(timeSlot);
  if (!range) return timeSlot.trim();
  return `${String(Math.floor(range.start / 60)).padStart(2, "0")}:${String(range.start % 60).padStart(2, "0")} - ${String(Math.floor(range.end / 60)).padStart(2, "0")}:${String(range.end % 60).padStart(2, "0")}`;
}

export function minutesTo24h(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface AlignableSlot {
  timeSlot: string;
  task?: string;
  title?: string;
}

/**
 * Picks the grid slot an entry belongs to: largest overlap; on a tie, the slot containing the
 * entry's start; with no overlap at all, the nearest slot. Returns -1 if nothing is parseable.
 */
function pickGridIndex(entry: ParsedTimeRange, grid: Array<ParsedTimeRange | null>): number {
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

/**
 * Maps saved entries onto the current shift's slot grid (e.g. after a shift change), joining
 * entries that land in the same slot with " | ". Entries whose time can't be parsed keep their
 * own timeSlot. Mirrors apps/api_hr_portal/src/modules/timesheet/slotAlignment.ts, which
 * rewrites the saved data the same way — keep them in sync.
 */
export function alignSlotsToGrid(
  entries: AlignableSlot[],
  grid: string[],
): Array<{ timeSlot: string; task: string }> {
  const gridRanges = grid.map((g) => parseTimeSlotRange(g));
  const buckets = new Map<string, Array<{ start: number; task: string }>>();

  for (const entry of entries) {
    const task = entry.task?.trim();
    if (!task) continue;

    const timeSlot = entry.timeSlot.trim();
    const range = parseTimeSlotRange(timeSlot);
    const exact = grid.indexOf(timeSlot);
    const index = exact !== -1 ? exact : range ? pickGridIndex(range, gridRanges) : -1;
    const target = index === -1 ? timeSlot : grid[index];

    const bucket = buckets.get(target) ?? [];
    bucket.push({ start: range?.start ?? 0, task });
    buckets.set(target, bucket);
  }

  return [...buckets.entries()].map(([timeSlot, bucket]) => ({
    timeSlot,
    task: bucket.sort((a, b) => a.start - b.start).map((b) => b.task).join(" | "),
  }));
}
