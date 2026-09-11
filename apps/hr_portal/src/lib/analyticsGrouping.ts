import dayjs, { Dayjs } from "dayjs";

export type ChartGranularity = "hourly" | "daily" | "weekly" | "monthly";

export interface DayActivity {
  date: string;
  submittedCount: number;
  totalHours: number;
  rate: number;
}

export interface HourActivity {
  hour: number;
  label: string;
  hours: number;
  slotCount: number;
}

export interface ChartPoint {
  key: string;
  label: string;
  shortLabel: string;
  hours: number;
  entryCount: number;
  secondaryValue: string;
}

/** Pick chart bucket size from the selected date span. */
export function getChartGranularity(from: Dayjs, to: Dayjs): ChartGranularity {
  const spanDays = to.startOf("day").diff(from.startOf("day"), "day") + 1;
  if (spanDays === 1) return "hourly";
  if (spanDays <= 14) return "daily";
  if (spanDays <= 120) return "weekly";
  return "monthly";
}

export function getGranularityHint(from: Dayjs, to: Dayjs): string {
  const spanDays = to.startOf("day").diff(from.startOf("day"), "day") + 1;
  const granularity = getChartGranularity(from, to);

  if (granularity === "hourly") {
    return `Single day (${from.format("MMM D, YYYY")}) — showing hours logged by time of day.`;
  }
  if (granularity === "daily") {
    return `${spanDays} day range — showing each working day.`;
  }
  if (granularity === "weekly") {
    return `${spanDays} day range — grouped by week for readability (not ${spanDays} separate days).`;
  }
  return `${spanDays} day range — grouped by month for readability.`;
}

function startOfWeekMonday(date: Dayjs): Dayjs {
  const day = date.day();
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, "day").startOf("day");
}

function endOfWeekMonday(date: Dayjs): Dayjs {
  return startOfWeekMonday(date).add(6, "day");
}

export function getGranularityLabel(granularity: ChartGranularity): string {
  switch (granularity) {
    case "hourly":
      return "Hourly view";
    case "daily":
      return "Daily view";
    case "weekly":
      return "Weekly view";
    case "monthly":
      return "Monthly view";
  }
}

export function getChartCopy(granularity: ChartGranularity) {
  switch (granularity) {
    case "hourly":
      return {
        barTitle: "Hours by hour",
        barDescription:
          "Total hours logged in each hour of the day, aggregated across all employees.",
        trendTitle: "Hourly activity trend",
        trendDescription:
          "How logged hours are distributed throughout the day (00:00 – 23:00).",
      };
    case "daily":
      return {
        barTitle: "Hours by day",
        barDescription: "Total hours logged on each working day in the selected period.",
        trendTitle: "Daily hours trend",
        trendDescription: "How logged hours change day by day across the period.",
      };
    case "weekly":
      return {
        barTitle: "Hours by week",
        barDescription:
          "Total hours logged per week within the selected date range (partial weeks at the start or end are included).",
        trendTitle: "Weekly hours trend",
        trendDescription:
          "How logged hours change week over week within the selected date range.",
      };
    case "monthly":
      return {
        barTitle: "Hours by month",
        barDescription: "Total hours logged per calendar month in the selected period.",
        trendTitle: "Monthly hours trend",
        trendDescription: "How logged hours change month over month across the period.",
      };
  }
}

export function aggregateHourlyForCharts(hourlyActivity: HourActivity[]): ChartPoint[] {
  return hourlyActivity.map((hour) => ({
    key: String(hour.hour),
    label: hour.label,
    shortLabel: hour.label,
    hours: hour.hours,
    entryCount: hour.slotCount,
    secondaryValue: `${hour.slotCount} time entries`,
  }));
}

export function aggregateActivityForCharts(
  dailyActivity: DayActivity[],
  from: Dayjs,
  to: Dayjs,
  granularity: ChartGranularity,
): ChartPoint[] {
  const activityByDate = new Map(dailyActivity.map((day) => [day.date, day]));

  if (granularity === "hourly") {
    return [];
  }

  if (granularity === "daily") {
    const points: ChartPoint[] = [];
    let cursor = from.startOf("day");
    const end = to.startOf("day");

    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      const dow = cursor.day();
      if (dow !== 0 && dow !== 6) {
        const dateStr = cursor.format("YYYY-MM-DD");
        const day = activityByDate.get(dateStr);
        points.push({
          key: dateStr,
          label: cursor.format("dddd, MMM D, YYYY"),
          shortLabel: cursor.format("MMM D"),
          hours: day?.totalHours ?? 0,
          entryCount: day?.submittedCount ?? 0,
          secondaryValue: day
            ? `${day.submittedCount} employees · ${day.rate}% compliance`
            : "No activity",
        });
      }
      cursor = cursor.add(1, "day");
    }

    return points;
  }

  if (granularity === "weekly") {
    const rangeStart = from.startOf("day");
    const rangeEnd = to.startOf("day");
    const weekMap = new Map<
      string,
      { hours: number; entryCount: number; displayStart: Dayjs; displayEnd: Dayjs }
    >();

    let cursor = rangeStart;
    while (cursor.isBefore(rangeEnd) || cursor.isSame(rangeEnd, "day")) {
      const calWeekStart = startOfWeekMonday(cursor);
      const calWeekEnd = endOfWeekMonday(cursor);
      const displayStart = calWeekStart.isBefore(rangeStart) ? rangeStart : calWeekStart;
      const displayEnd = calWeekEnd.isAfter(rangeEnd) ? rangeEnd : calWeekEnd;
      const key = displayStart.format("YYYY-MM-DD");

      if (!weekMap.has(key)) {
        weekMap.set(key, {
          hours: 0,
          entryCount: 0,
          displayStart,
          displayEnd,
        });
      }
      cursor = cursor.add(1, "day");
    }

    for (const day of dailyActivity) {
      const date = dayjs(day.date).startOf("day");
      if (date.isBefore(rangeStart) || date.isAfter(rangeEnd)) continue;

      const calWeekStart = startOfWeekMonday(date);
      const displayStart = calWeekStart.isBefore(rangeStart) ? rangeStart : calWeekStart;
      const key = displayStart.format("YYYY-MM-DD");
      const bucket = weekMap.get(key);
      if (!bucket) continue;
      bucket.hours += day.totalHours;
      bucket.entryCount += day.submittedCount;
    }

    return [...weekMap.values()]
      .sort((a, b) => a.displayStart.valueOf() - b.displayStart.valueOf())
      .map((week) => ({
        key: week.displayStart.format("YYYY-MM-DD"),
        label: `${week.displayStart.format("MMM D")} – ${week.displayEnd.format("MMM D, YYYY")}`,
        shortLabel:
          week.displayStart.month() === week.displayEnd.month() &&
          week.displayStart.year() === week.displayEnd.year()
            ? `${week.displayStart.format("MMM D")}–${week.displayEnd.format("D")}`
            : `${week.displayStart.format("MMM D")}–${week.displayEnd.format("MMM D")}`,
        hours: Math.round(week.hours * 60) / 60,
        entryCount: week.entryCount,
        secondaryValue: `${week.entryCount} employee-days logged`,
      }));
  }

  const monthMap = new Map<
    string,
    { hours: number; entryCount: number; month: Dayjs }
  >();

  let cursor = from.startOf("month");
  const end = to.startOf("day");

  while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
    const key = cursor.format("YYYY-MM");
    monthMap.set(key, { hours: 0, entryCount: 0, month: cursor.startOf("month") });
    cursor = cursor.add(1, "month");
  }

  for (const day of dailyActivity) {
    const key = dayjs(day.date).format("YYYY-MM");
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.hours += day.totalHours;
    bucket.entryCount += day.submittedCount;
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, month]) => ({
      key,
      label: month.month.format("MMMM YYYY"),
      shortLabel: month.month.format("MMM YY"),
      hours: Math.round(month.hours * 60) / 60,
      entryCount: month.entryCount,
      secondaryValue: `${month.entryCount} employee-days logged`,
    }));
}
