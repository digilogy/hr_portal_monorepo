import dayjs from "dayjs";

export interface ActivitySlot {
  task?: string;
  timeSlot?: string;
  title?: string;
  taskType?: string;
}

export interface ActivityTimesheetEntry {
  date: string;
  totalHours: number;
  slots: ActivitySlot[];
}

export type DayActivityStatus = "complete" | "partial" | "low" | "pending";

export interface DayActivity {
  date: string;
  dateLabel: string;
  isToday: boolean;
  isLogged: boolean;
  totalHours: number;
  taskCount: number;
  slotCount: number;
  progressPercent: number;
  status: DayActivityStatus;
  highlights: string[];
  summary: string;
  timeRange?: string;
}

const DAILY_TARGET_HOURS = 8.5;

function getSlotLabel(slot: ActivitySlot): string {
  if (slot.taskType === "Custom" && slot.title?.trim()) {
    return slot.title.trim();
  }
  if (slot.taskType?.trim() && slot.taskType !== "Custom") {
    return slot.taskType.trim();
  }
  if (slot.title?.trim()) return slot.title.trim();
  return "";
}

export function truncateActivityText(
  text: string,
  maxWords = 4,
  maxChars = 48,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  const byWords =
    words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : trimmed;

  if (byWords.length <= maxChars) return byWords;
  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
}

function getFilledSlots(slots: ActivitySlot[]): ActivitySlot[] {
  return slots.filter(
    (slot) =>
      slot.task?.trim() ||
      slot.title?.trim() ||
      (slot.taskType && slot.taskType !== "Custom"),
  );
}

function getActivityStatus(totalHours: number, isLogged: boolean): DayActivityStatus {
  if (!isLogged || totalHours <= 0) return "pending";
  if (totalHours >= DAILY_TARGET_HOURS) return "complete";
  if (totalHours >= DAILY_TARGET_HOURS * 0.5) return "partial";
  return "low";
}

function getTimeRange(slots: ActivitySlot[]): string | undefined {
  const ranges = slots
    .map((slot) => slot.timeSlot?.trim())
    .filter(Boolean) as string[];

  if (ranges.length === 0) return undefined;
  if (ranges.length === 1) return ranges[0];

  const first = ranges[0]?.split(" - ")[0]?.trim();
  const last = ranges[ranges.length - 1]?.split(" - ")[1]?.trim();
  if (first && last) return `${first} – ${last}`;
  return `${ranges.length} slots`;
}

export function formatActivityDate(dateStr: string): string {
  const date = dayjs(dateStr);
  const today = dayjs().startOf("day");

  if (date.isSame(today, "day")) return "Today";
  if (date.isSame(today.subtract(1, "day"), "day")) return "Yesterday";
  return date.format("ddd, MMM D");
}

export function summarizeDayActivity(entry: ActivityTimesheetEntry): {
  highlights: string[];
  summary: string;
} {
  const filledSlots = getFilledSlots(entry.slots);
  if (filledSlots.length === 0) {
    return {
      highlights: [],
      summary: "Hours logged without task details",
    };
  }

  const labels = filledSlots
    .map((slot) => {
      const label = getSlotLabel(slot);
      if (label) return truncateActivityText(label);
      if (slot.task?.trim()) return truncateActivityText(slot.task, 3, 36);
      return "";
    })
    .filter(Boolean);

  const uniqueHighlights = [...new Set(labels)];

  if (uniqueHighlights.length === 0) {
    return {
      highlights: [],
      summary: `${filledSlots.length} slot${filledSlots.length === 1 ? "" : "s"} logged`,
    };
  }

  if (uniqueHighlights.length === 1) {
    const summary =
      filledSlots.length > 1
        ? `${uniqueHighlights[0]} · ${filledSlots.length} slots`
        : uniqueHighlights[0];
    return { highlights: uniqueHighlights, summary };
  }

  const summary = `${uniqueHighlights[0]}, ${uniqueHighlights[1]}${
    filledSlots.length > 2 ? ` +${filledSlots.length - 2} more` : ""
  }`;

  return {
    highlights: uniqueHighlights.slice(0, 3),
    summary,
  };
}

export function buildDayActivity(
  date: string,
  entry: ActivityTimesheetEntry | null | undefined,
): DayActivity {
  const isToday = dayjs(date).isSame(dayjs(), "day");
  const totalHours = entry?.totalHours ?? 0;
  const isLogged = totalHours > 0;
  const filledSlots = entry ? getFilledSlots(entry.slots) : [];
  const { highlights, summary } = entry
    ? summarizeDayActivity(entry)
    : { highlights: [], summary: "No timesheet logged yet" };

  return {
    date,
    dateLabel: formatActivityDate(date),
    isToday,
    isLogged,
    totalHours,
    taskCount: filledSlots.length,
    slotCount: entry?.slots.length ?? 0,
    progressPercent: Math.min(
      100,
      Math.round((totalHours / DAILY_TARGET_HOURS) * 100),
    ),
    status: getActivityStatus(totalHours, isLogged),
    highlights,
    summary,
    timeRange: entry ? getTimeRange(filledSlots) : undefined,
  };
}

export function buildRecentWeekActivity(
  weekEntries: ActivityTimesheetEntry[],
  weekStart: dayjs.Dayjs,
  throughDate: dayjs.Dayjs = dayjs(),
  limit = 5,
): DayActivity[] {
  const entryMap = new Map(
    weekEntries.map((entry) => [dayjs(entry.date).format("YYYY-MM-DD"), entry]),
  );

  const dates: string[] = [];
  let cursor = throughDate.startOf("day");
  const start = weekStart.startOf("day");

  while (cursor.isAfter(start) || cursor.isSame(start, "day")) {
    const day = cursor.day();
    if (day !== 0) {
      dates.push(cursor.format("YYYY-MM-DD"));
    }
    cursor = cursor.subtract(1, "day");
  }

  return dates.slice(0, limit).map((date) => buildDayActivity(date, entryMap.get(date)));
}
