import { TimesheetSlot } from "@hr-portal/database";

interface ParsedTimeRange {
  start: number;
  end: number;
}

function parseMinutes(timeStr: string): number | null {
  const [time, period] = timeStr.trim().split(" ");
  if (!time || !period) return null;

  const [hStr, mStr] = time.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;

  return h * 60 + m;
}

function parseTimeSlotRange(timeSlot: string): ParsedTimeRange | null {
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

export function validateTimesheetSlots(slots: TimesheetSlot[]): void {
  const filledSlots = slots.filter((slot) => slot.timeSlot?.trim());

  for (let i = 0; i < filledSlots.length; i++) {
    const slot = filledSlots[i];
    if (isInvalidTimeOrder(slot.timeSlot)) {
      throw new Error("End time must be after start time on the same day.");
    }

    const candidate = parseTimeSlotRange(slot.timeSlot);
    if (!candidate) {
      throw new Error(`Invalid time slot: ${slot.timeSlot}`);
    }

    const candidateNorm = normalizeTimeSlot(slot.timeSlot);

    for (let j = 0; j < filledSlots.length; j++) {
      if (i === j) continue;

      const other = filledSlots[j];
      const existing = parseTimeSlotRange(other.timeSlot);
      if (!existing) continue;

      if (normalizeTimeSlot(other.timeSlot) === candidateNorm) {
        throw new Error("Duplicate time slots are not allowed.");
      }

      if (rangesOverlap(candidate, existing)) {
        throw new Error(
          `Overlapping time slots are not allowed (${slot.timeSlot} and ${other.timeSlot}).`,
        );
      }
    }
  }
}
