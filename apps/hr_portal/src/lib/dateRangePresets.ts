import dayjs, { Dayjs } from "dayjs";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export const PERIOD_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

export function getPresetDateRange(
  preset: Exclude<PeriodPreset, "custom">,
): [Dayjs, Dayjs] {
  const today = dayjs();

  switch (preset) {
    case "today":
      return [today, today];
    case "yesterday": {
      const yesterday = today.subtract(1, "day");
      return [yesterday, yesterday];
    }
    case "last_week": {
      const lastWeek = today.subtract(1, "week");
      return [lastWeek.startOf("week"), lastWeek.endOf("week")];
    }
    case "this_month":
      return [today.startOf("month"), today];
    case "last_month": {
      const lastMonth = today.subtract(1, "month");
      return [lastMonth.startOf("month"), lastMonth.endOf("month")];
    }
    case "this_week":
    default:
      return [today.startOf("week"), today];
  }
}

export function getEffectiveDateRange(
  preset: PeriodPreset,
  customRange: [Dayjs, Dayjs] | null,
): [Dayjs, Dayjs] {
  if (preset === "custom" && customRange?.[0] && customRange?.[1]) {
    return customRange;
  }

  return getPresetDateRange(preset === "custom" ? "this_week" : preset);
}

const VALID_PERIOD_PRESETS = new Set<PeriodPreset>([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
]);

export function appendPeriodToSearchParams(
  params: URLSearchParams,
  preset: PeriodPreset,
  customRange: [Dayjs, Dayjs] | null,
): URLSearchParams {
  params.set("period", preset);
  if (preset === "custom" && customRange?.[0] && customRange?.[1]) {
    params.set("fromDate", customRange[0].format("YYYY-MM-DD"));
    params.set("toDate", customRange[1].format("YYYY-MM-DD"));
  }
  return params;
}

export function parsePeriodFromSearchParams(searchParams: URLSearchParams): {
  periodPreset: PeriodPreset;
  customRange: [Dayjs, Dayjs] | null;
} {
  const period = searchParams.get("period");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  if (
    period === "custom" &&
    fromDate &&
    toDate &&
    dayjs(fromDate).isValid() &&
    dayjs(toDate).isValid()
  ) {
    return {
      periodPreset: "custom",
      customRange: [dayjs(fromDate), dayjs(toDate)],
    };
  }

  if (period && VALID_PERIOD_PRESETS.has(period as PeriodPreset) && period !== "custom") {
    return {
      periodPreset: period as PeriodPreset,
      customRange: null,
    };
  }

  if (
    fromDate &&
    toDate &&
    dayjs(fromDate).isValid() &&
    dayjs(toDate).isValid()
  ) {
    return {
      periodPreset: "custom",
      customRange: [dayjs(fromDate), dayjs(toDate)],
    };
  }

  return { periodPreset: "this_week", customRange: null };
}
