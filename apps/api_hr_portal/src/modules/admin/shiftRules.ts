/**
 * Rules for the master sheet's shift columns: the "Weekly Off" label on each employee, and the
 * Shift Detail tab's "Allowed Timings" and "Half Day" cells.
 *
 * Weekly off is stored in canonical form ("Sun", "Sun, 2nd Sat", "Tue", "None"). Every off-day
 * parser in the app (dashboard, timesheet, team reports, timesheet page) reads that form.
 * Working days are never stored: they are every weekday that is not an off day.
 */

/** Used when neither the employee nor the shift has a weekly off. */
export const DEFAULT_WEEKLY_OFF = "Sun";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const NTH_INDEX: Record<string, number> = {
  "1st": 1, first: 1,
  "2nd": 2, second: 2,
  "3rd": 3, third: 3,
  "4th": 4, fourth: 4,
  "5th": 5, fifth: 5,
};
const NTH_LABEL = ["", "1st", "2nd", "3rd", "4th", "5th"];

// Labels HR uses whose meaning isn't in the words themselves (confirmed by HR, 2026-10-30).
const WEEKLY_OFF_LABELS: Record<string, string> = {
  "all sunday & 2nd saturday off": "Sun, 2nd Sat",
  "all sunday off": "Sun",
  "general off": "Sun",
  "office off": "Sun, 2nd Sat",
  "all tuesday off": "Tue",
  "tuesday off": "Tue",
  "marketing off": "Tue",
  "all thursday off": "Thu",
};

export const WEEKLY_OFF_ALLOWED_TEXT =
  "All Sunday & 2nd Saturday Off, All Sunday Off, General Off, Office Off, All Tuesday Off, " +
  "Tuesday Off, Marketing Off, All Thursday Off, or \"All <Day> Off\", optionally followed by the " +
  "days in brackets, e.g. \"All Sunday Off (All Sunday)\" or \"Marketing Off (All Tuesday, First Wednesday)\"";

/** Own-property lookup, so cell text like "constructor" never matches a built-in. */
function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Shift name as saved: trimmed, repeated spaces collapsed. */
export function normalizeShiftName(name: string): string {
  return collapseSpaces(name);
}

/** Key for matching shift names: ignores case and repeated spaces. */
export function shiftKey(name: string): string {
  return normalizeShiftName(name).toLowerCase();
}

/**
 * Converts a sheet label ("All Sunday & 2nd Saturday Off") or an already canonical value
 * ("Sun, 2nd Sat", the old Shift Detail "Off Days") to canonical form. Returns null when the
 * value is empty or not understood; it never guesses.
 *
 * The HRMS export writes the label followed by its days in brackets:
 * "Marketing Off (All Tuesday, First Wednesday)". The bracket lists the actual off days, so it
 * is used when it can be read; otherwise the label decides.
 */
export function normalizeWeeklyOff(value: string | null | undefined): string | null {
  const text = collapseSpaces(value ?? "").toLowerCase();
  if (!text) return null;

  const bracketed = text.match(/^(.*?)\s*\(([^()]*)\)$/);
  if (bracketed) {
    return parseDayList(bracketed[2]) ?? normalizeLabel(bracketed[1]);
  }
  return normalizeLabel(text);
}

function normalizeLabel(text: string): string | null {
  if (!text) return null;

  const known = lookup(WEEKLY_OFF_LABELS, text);
  if (known) return known;

  if (text === "none") return "None";

  const allDayOff = text.match(/^all ([a-z]+) off$/);
  if (allDayOff) {
    const day = lookup(DAY_INDEX, allDayOff[1]);
    return day === undefined ? null : DAY_ABBR[day];
  }

  return parseDayList(text);
}

/**
 * Day lists: "Sun", "Sun, 2nd Sat", "Sunday, second Saturday", "All Tuesday, First Wednesday".
 * Output is ordered every-week days first (Sun..Sat), then nth days, so the same days always
 * give the same string.
 */
function parseDayList(text: string): string | null {
  const fullDays = new Set<number>();
  const nthDays = new Map<string, [number, number]>();
  for (const part of text.split(",").map((p) => p.trim()).filter(Boolean)) {
    const pair = part.match(/^([a-z0-9]+) ([a-z]+)$/);
    const pairDay = pair ? lookup(DAY_INDEX, pair[2]) : undefined;
    const nthIndex = pair ? lookup(NTH_INDEX, pair[1]) : undefined;
    const day = lookup(DAY_INDEX, part);
    if (pair && pair[1] === "all" && pairDay !== undefined) {
      fullDays.add(pairDay);
    } else if (nthIndex !== undefined && pairDay !== undefined) {
      nthDays.set(`${nthIndex}-${pairDay}`, [nthIndex, pairDay]);
    } else if (day !== undefined) {
      fullDays.add(day);
    } else {
      return null;
    }
  }

  const tokens = [...fullDays].sort((a, b) => a - b).map((d) => DAY_ABBR[d]);
  const nthSorted = [...nthDays.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [n, d] of nthSorted) tokens.push(`${NTH_LABEL[n]} ${DAY_ABBR[d]}`);
  return tokens.length > 0 ? tokens.join(", ") : null;
}

/** Off-day rule for date checks: days off every week, and nth-weekday-of-month days off. */
export function parseWeeklyOff(value: string | null | undefined): {
  fullDays: Set<number>;
  nthDays: Array<{ nth: number; day: number }>;
} {
  const canonical = normalizeWeeklyOff(value) ?? DEFAULT_WEEKLY_OFF;
  const fullDays = new Set<number>();
  const nthDays: Array<{ nth: number; day: number }> = [];
  if (canonical === "None") return { fullDays, nthDays };
  for (const token of canonical.split(", ")) {
    const [first, second] = token.split(" ");
    if (second) nthDays.push({ nth: NTH_LABEL.indexOf(first), day: DAY_ABBR.indexOf(second) });
    else fullDays.add(DAY_ABBR.indexOf(first));
  }
  return { fullDays, nthDays };
}

/** True when the date (day of week 0-6, day of month 1-31) is a weekly off under the rule. */
export function isWeeklyOffDay(
  rule: ReturnType<typeof parseWeeklyOff>,
  dayOfWeek: number,
  dayOfMonth: number,
): boolean {
  if (rule.fullDays.has(dayOfWeek)) return true;
  const occurrence = Math.ceil(dayOfMonth / 7);
  return rule.nthDays.some((n) => n.day === dayOfWeek && n.nth === occurrence);
}

/** The weekly off that applies: the employee's own, else the shift's (old sheets), else Sunday. */
export function resolveWeeklyOff(employeeWeeklyOff?: string | null, shiftOffDays?: string | null): string {
  return employeeWeeklyOff?.trim() || shiftOffDays?.trim() || DEFAULT_WEEKLY_OFF;
}

/**
 * Working days for display, worked out from a canonical weekly off:
 * "Sun, 2nd Sat" -> "Mon-Sat (except 2nd Sat)", "Tue" -> "Mon, Wed-Sun".
 */
export function describeWorkingDays(weeklyOff: string): string {
  const fullOff = new Set<number>();
  const nthOff: string[] = [];
  const canonical = normalizeWeeklyOff(weeklyOff) ?? DEFAULT_WEEKLY_OFF;
  if (canonical !== "None") {
    for (const token of canonical.split(", ")) {
      const [first, second] = token.split(" ");
      if (second) nthOff.push(token);
      else fullOff.add(DAY_ABBR.indexOf(first));
    }
  }

  // Mon..Sun order, so "Tue off" reads "Mon, Wed-Sun".
  const order = [1, 2, 3, 4, 5, 6, 0];
  const ranges: string[] = [];
  let start = -1;
  for (let i = 0; i <= order.length; i++) {
    const working = i < order.length && !fullOff.has(order[i]);
    if (working && start === -1) start = i;
    if (!working && start !== -1) {
      const end = i - 1;
      ranges.push(start === end ? DAY_ABBR[order[start]] : `${DAY_ABBR[order[start]]}-${DAY_ABBR[order[end]]}`);
      start = -1;
    }
  }

  const days = ranges.length > 0 ? ranges.join(", ") : "None";
  const exceptions = nthOff.filter((token) => !fullOff.has(DAY_ABBR.indexOf(token.split(" ")[1])));
  return exceptions.length > 0 ? `${days} (except ${exceptions.join(", ")})` : days;
}

type Checked = { ok: true; value: string } | { ok: false; reason: string };

function parseClock(text: string): { ok: true; minutes: number; value: string } | { ok: false; reason: string } {
  const match = text.match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!match) return { ok: false, reason: `"${text}" is not a time` };
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return { ok: false, reason: `"${text}" is not a valid time (hours 0–23, minutes 0–59)` };
  }
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { ok: true, minutes: hours * 60 + minutes, value };
}

function checkTimeRange(text: string): Checked {
  const parts = text.split(/\s*(?:-|–|—|\bto\b)\s*/i).map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: `"${text}" is not in the form start - end` };
  }
  const start = parseClock(parts[0]);
  if (!start.ok) return start;
  const end = parseClock(parts[1]);
  if (!end.ok) return end;
  if (start.minutes === end.minutes) return { ok: false, reason: "start and end are the same" };
  return { ok: true, value: `${start.value} - ${end.value}` };
}

/**
 * Checks "Allowed Timings" and returns it as "HH:MM - HH:MM", several options joined by ", ".
 * "9.30 - 19.30" -> "09:30 - 19:30"; "10:00 -19:00" -> "10:00 - 19:00".
 */
export function normalizeAllowedTimings(value: string): Checked {
  const options = value.split(/[\n,]+/).map((o) => o.trim()).filter(Boolean);
  if (options.length === 0) return { ok: false, reason: "it is empty" };
  const normalized: string[] = [];
  for (const option of options) {
    const checked = checkTimeRange(option);
    if (!checked.ok) return checked;
    normalized.push(checked.value);
  }
  return { ok: true, value: normalized.join(", ") };
}

const HALF_DAY_FORM = "it is not in the form Day (HH:MM - HH:MM)";
// Days in a Half Day cell: "Sat, Sun", "Sat & Sun", "Sat and Sun".
const DAY_LIST_SEPARATOR = /\s*(?:,|&|\band\b)\s*/i;
// Mon..Sun, the order days are saved in.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Reads a saved Half Day value, "Sat (08:00 - 12:30)" or "Sat, Sun (09:30 - 19:30)": the days it
 * applies to and that day's start and end. Lenient, for values saved before uploads were checked;
 * null if it isn't in that form.
 */
export function parseDayTiming(value: string | null | undefined): { days: number[]; start: string; end: string } | null {
  const match = (value ?? "").trim().match(/^(.+?)\s*\((.*)\)$/);
  if (!match) return null;
  const days: number[] = [];
  for (const name of match[1].split(DAY_LIST_SEPARATOR).filter(Boolean)) {
    const day = lookup(DAY_INDEX, name.toLowerCase());
    if (day === undefined) return null;
    if (!days.includes(day)) days.push(day);
  }
  const parts = match[2].split(/\s*(?:-|–|—|\bto\b)\s*/i).map((p) => p.trim());
  if (days.length === 0 || parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [start, end] = parts.map((p) => {
    const clock = parseClock(p);
    return clock.ok ? clock.value : p;
  });
  return { days, start, end };
}

/**
 * Checks "Half Day" and returns it normalized. One or more days share one timing:
 * "Sat (08.00 - 12.30)" -> "Sat (08:00 - 12:30)", "Sat and sun (9.30 - 19.30)" -> "Sat, Sun (09:30 - 19:30)".
 * Empty is allowed.
 */
export function normalizeHalfDay(value: string): Checked {
  const text = value.trim();
  if (!text) return { ok: true, value: "" };
  const match = text.match(/^(.+?)\s*\((.*)\)$/);
  if (!match) return { ok: false, reason: HALF_DAY_FORM };
  const days: number[] = [];
  for (const name of match[1].split(DAY_LIST_SEPARATOR).filter(Boolean)) {
    const day = lookup(DAY_INDEX, name.toLowerCase());
    if (day === undefined) return { ok: false, reason: `"${name}" is not a day` };
    if (!days.includes(day)) days.push(day);
  }
  if (days.length === 0) return { ok: false, reason: HALF_DAY_FORM };
  const range = checkTimeRange(match[2].trim());
  if (!range.ok) return range;
  days.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  return { ok: true, value: `${days.map((d) => DAY_ABBR[d]).join(", ")} (${range.value})` };
}
