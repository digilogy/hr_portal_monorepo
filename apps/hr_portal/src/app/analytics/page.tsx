"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  DatePicker,
  Select,
  Spin,
  Tag,
} from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { Dayjs } from "dayjs";
import { canAccessAnalytics, getTokenRole } from "@/lib/auth";
import { isAdminPortalHost } from "@/lib/host";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  appendReportFilters,
  DEFAULT_REPORT_FILTERS,
  hasActiveReportFilters,
  type ReportFilters,
  type ReportFilterOptions,
} from "@/lib/reportFilters";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import { FilterField } from "@/components/ui/FilterField";
import {
  PERIOD_PRESET_OPTIONS,
  PeriodPreset,
  getEffectiveDateRange,
} from "@/lib/dateRangePresets";
import { WorkRhythm } from "@/components/analytics/WorkRhythm";
import { TaskDistribution } from "@/components/analytics/TaskDistribution";
import { type DayActivity } from "@/lib/analyticsGrouping";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface AnalyticsData {
  summary: {
    totalLoggedHours: number;
    headcount: number;
    avgUtilization: number;
    timesheetsSubmitted: number;
  };
  distribution: Array<{
    category: string;
    hours: number;
    percentage: number;
    rate: number;
  }>;
  byDayOfWeek: Array<{ day: string; hours: number; entryCount: number }>;
  byHour?: Array<{ hour: number; label: string; hours: number; slotCount: number }>;
  dailyActivity: DayActivity[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [adminFilters, setAdminFilters] = useState<ReportFilters>(
    DEFAULT_REPORT_FILTERS,
  );
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const dateRange = useMemo(() => {
    const [from, to] = getEffectiveDateRange(periodPreset, customRange);
    return {
      fromDate: from.format("YYYY-MM-DD"),
      toDate: to.format("YYYY-MM-DD"),
      label: `${from.format("MMM D")} – ${to.format("MMM D, YYYY")}`,
    };
  }, [periodPreset, customRange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = getTokenRole();
    if (!canAccessAnalytics(role)) {
      router.replace("/timesheet");
      return;
    }

    const endpoint =
      role === "admin"
        ? "/api/reports/filter-options"
        : "/api/reports/filter-options/scoped";
    void apiFetch<ReportFilterOptions>(endpoint)
      .then(setFilterOptions)
      .catch(console.error);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = getTokenRole();
    if (!canAccessAnalytics(role)) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        appendReportFilters(params, adminFilters);
        const result = await apiFetch<AnalyticsData>(
          `/api/reports/workforce-pulse?${params}`,
        );
        setData(result);
      } catch (error: unknown) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [router, dateRange.fromDate, dateRange.toDate, adminFilters]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1 mb-2">
        <Title level={2} className="!mb-0 text-xl md:text-3xl">
          Analytics Dashboard
        </Title>
        <Text className="text-gray-500">
          Logging activity across your organization. Short ranges show daily detail;
          longer ranges group by week or month so charts stay readable.
        </Text>
      </div>

      <Card
        variant="borderless"
        className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
        styles={{ body: { padding: 20 } }}
      >
        <div className="flex flex-col gap-5">
          <AdminReportFilters
            value={adminFilters}
            options={filterOptions}
            loading={!filterOptions && loading}
            onChange={setAdminFilters}
          />
          <div className="flex flex-col sm:flex-row flex-wrap items-end gap-4">

            <FilterField label="Period" icon={<CalendarOutlined />} className="w-full sm:w-44">
              <Select
                value={periodPreset}
                onChange={(value: PeriodPreset) => {
                  if (value === "custom") {
                    setCustomRange(getEffectiveDateRange(periodPreset, customRange));
                  } else {
                    setCustomRange(null);
                  }
                  setPeriodPreset(value);
                }}
                className="w-full"
                options={PERIOD_PRESET_OPTIONS}
              />
            </FilterField>

            <FilterField label="Date Range" className="w-full sm:w-auto">
              <RangePicker
                className="w-full"
                value={getEffectiveDateRange(periodPreset, customRange)}
                onChange={(dates) => {
                  if (dates?.[0] && dates?.[1]) {
                    setPeriodPreset("custom");
                    setCustomRange([dates[0], dates[1]]);
                  } else {
                    setCustomRange(null);
                    setPeriodPreset("this_month");
                  }
                }}
                disabled={periodPreset !== "custom"}
              />
            </FilterField>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
            <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-gray-200 !bg-gray-50 !text-gray-600">
              {dateRange.label}
            </Tag>
            {hasActiveReportFilters(adminFilters) && (
              <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-[#F5A623]/30 !bg-[#F5A623]/10 !text-[#c4841a]">
                Filtered
              </Tag>
            )}
            {loading && data && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 ml-auto">
                <Spin size="small" />
                Refreshing…
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="relative">
        {loading && data && (
          <div className="absolute inset-0 z-10 rounded-xl bg-white/40 dark:bg-black/20 pointer-events-none" />
        )}

        <Card
          variant="borderless"
          className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          {/* <div className="h-1 bg-animated-gradient" /> */}
          <div className="p-6 md:p-8">
            {/* <div className="flex items-start gap-3 mb-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#F5A623] text-lg">
                <BarChartOutlined />
              </div>
              <div>
                <Title level={4} className="!mb-1 text-gray-800 dark:text-zinc-100">
                  Work Rhythm
                </Title>
                <Text className="text-gray-500 text-sm">
                  When your organization is most active — weekday totals and daily
                  hours over the selected period.
                </Text>
              </div>
            </div> */}

            <WorkRhythm
              dailyActivity={data?.dailyActivity ?? []}
              hourlyActivity={data?.byHour ?? []}
              fromDate={dateRange.fromDate}
              toDate={dateRange.toDate}
            />
          </div>
        </Card>

        {data?.distribution && data.distribution.length > 0 && (
          <div className="mt-8">
            <Title level={4} className="mb-4 text-gray-800 dark:text-zinc-100">
              Task Category Breakdown
            </Title>
            <TaskDistribution distribution={data.distribution} />
          </div>
        )}
      </div>
    </div>
  );
}
