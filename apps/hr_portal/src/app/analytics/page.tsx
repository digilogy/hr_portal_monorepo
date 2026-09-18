"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  DatePicker,
  Select,
  Spin,
  Tag,
  Button,
  Tooltip,
} from "antd";
import { CalendarOutlined, ClearOutlined } from "@ant-design/icons";
import { Dayjs } from "dayjs";
import { canAccessAnalytics, getTokenRole } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  appendReportFilters,
  DEFAULT_REPORT_FILTERS,
  hasActiveReportFilters,
  parseReportFiltersFromSearchParams,
  reportFiltersToSearchParams,
  sanitizeReportFilters,
  type ReportFilters,
  type ReportFilterOptions,
} from "@/lib/reportFilters";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import { FilterField } from "@/components/ui/FilterField";
import { FilterClearIcon } from "@/components/ui/FilterClearIcon";
import {
  PERIOD_PRESET_OPTIONS,
  PeriodPreset,
  appendPeriodToSearchParams,
  getEffectiveDateRange,
  parsePeriodFromSearchParams,
} from "@/lib/dateRangePresets";
import { WorkRhythm } from "@/components/analytics/WorkRhythm";
import { TaskDistribution } from "@/components/analytics/TaskDistribution";
import {
  UtilizationByDepartment,
  type DepartmentUtilizationItem,
} from "@/components/analytics/UtilizationByDepartment";
import {
  ComplianceByManager,
  type ManagerComplianceItem,
  type ManagerComplianceSummary,
} from "@/components/analytics/ComplianceByManager";
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
  departmentUtilization?: DepartmentUtilizationItem[];
  departmentSummary?: {
    totalDepartments: number;
    activeDepartments: number;
  };
  managerCompliance?: ManagerComplianceItem[];
  managerComplianceSummary?: ManagerComplianceSummary;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPeriod = useMemo(() => {
    return parsePeriodFromSearchParams(searchParams);
  }, [searchParams]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(
    initialPeriod.periodPreset,
  );
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(
    initialPeriod.customRange,
  );

  const [adminFilters, setAdminFilters] = useState<ReportFilters>(() => {
    return parseReportFiltersFromSearchParams(searchParams);
  });

  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const syncAnalyticsUrl = useCallback(
    (
      filters: ReportFilters,
      preset: PeriodPreset,
      range: [Dayjs, Dayjs] | null,
    ) => {
      const params = reportFiltersToSearchParams(filters);
      appendPeriodToSearchParams(params, preset, range);
      const query = params.toString();
      router.replace(query ? `/analytics?${query}` : "/analytics", { scroll: false });
    },
    [router],
  );

  const handlePeriodChange = useCallback(
    (preset: PeriodPreset, range: [Dayjs, Dayjs] | null = null) => {
      setPeriodPreset(preset);
      setCustomRange(range);
      syncAnalyticsUrl(adminFilters, preset, range);
    },
    [adminFilters, syncAnalyticsUrl],
  );

  const handleDateRangeChange = useCallback(
    (range: [Dayjs, Dayjs] | null) => {
      if (range) {
        setPeriodPreset("custom");
        setCustomRange(range);
        syncAnalyticsUrl(adminFilters, "custom", range);
      } else {
        setPeriodPreset("this_week");
        setCustomRange(null);
        syncAnalyticsUrl(adminFilters, "this_week", null);
      }
    },
    [adminFilters, syncAnalyticsUrl],
  );

  const handleAdminFiltersChange = useCallback(
    (filters: ReportFilters) => {
      setAdminFilters(filters);
      syncAnalyticsUrl(filters, periodPreset, customRange);
    },
    [periodPreset, customRange, syncAnalyticsUrl],
  );

  const handleClearAllAnalyticsFilters = useCallback(() => {
    const defaultFilters = DEFAULT_REPORT_FILTERS;
    const defaultPreset: PeriodPreset = "this_week";
    const defaultRange = null;

    setAdminFilters(defaultFilters);
    setPeriodPreset(defaultPreset);
    setCustomRange(defaultRange);

    const params = reportFiltersToSearchParams(defaultFilters);
    appendPeriodToSearchParams(params, defaultPreset, defaultRange);
    const query = params.toString();
    router.replace(query ? `/analytics?${query}` : "/analytics", { scroll: false });
  }, [router]);

  const isAnyFilterActive = useMemo(() => {
    return (
      hasActiveReportFilters(adminFilters) ||
      periodPreset !== "this_week" ||
      customRange !== null
    );
  }, [adminFilters, periodPreset, customRange]);

  useEffect(() => {
    const parsed = parseReportFiltersFromSearchParams(searchParams);
    if (filterOptions?.employees?.length) {
      setAdminFilters(sanitizeReportFilters(parsed, filterOptions.employees));
    } else {
      setAdminFilters(parsed);
    }

    const parsedPeriod = parsePeriodFromSearchParams(searchParams);
    setPeriodPreset(parsedPeriod.periodPreset);
    setCustomRange(parsedPeriod.customRange);
  }, [searchParams, filterOptions]);

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

  const adminFiltersStr = JSON.stringify(adminFilters);

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
        appendReportFilters(params, JSON.parse(adminFiltersStr));
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
  }, [router, dateRange.fromDate, dateRange.toDate, adminFiltersStr]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1 mb-2">
        <Title level={2} className="!mb-0 text-xl md:text-3xl">
          Analytics Dashboard
        </Title>
      </div>

      <Card
        variant="borderless"
        className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
        styles={{ body: { padding: 20 } }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
            <FilterField label="Period" icon={<CalendarOutlined />} className="w-full sm:w-44">
              <Select
                value={periodPreset}
                onChange={(value: PeriodPreset) => {
                  let newCustomRange: [Dayjs, Dayjs] | null = customRange;
                  if (value === "custom") {
                    newCustomRange = getEffectiveDateRange(periodPreset, customRange);
                    setCustomRange(newCustomRange);
                  } else {
                    newCustomRange = null;
                    setCustomRange(null);
                  }
                  handlePeriodChange(value, newCustomRange);
                }}
                className="w-full"
                options={PERIOD_PRESET_OPTIONS}
              />
            </FilterField>

            <div className="flex items-end gap-2 w-full sm:w-auto flex-1 sm:flex-initial">
              <FilterField label="Date Range" className="w-full sm:w-auto flex-1 sm:flex-initial">
                <RangePicker
                  className="w-full"
                  value={getEffectiveDateRange(periodPreset, customRange)}
                  onChange={(dates) => {
                    if (dates?.[0] && dates?.[1]) {
                      handleDateRangeChange([dates[0], dates[1]]);
                    } else {
                      handleDateRangeChange(null);
                    }
                  }}
                  disabled={periodPreset !== "custom"}
                />
              </FilterField>

              {isAnyFilterActive && (
                <Tooltip title="Clear Filters">
                  <Button
                    size="small"
                    icon={<FilterClearIcon size={26} />}
                    onClick={handleClearAllAnalyticsFilters}
                    className="!flex-none !flex !items-center !justify-center !p-1 !bg-transparent hover:!opacity-80 !border-none shadow-none mb-1"
                    aria-label="Clear Filters"
                  />
                </Tooltip>
              )}
            </div>
          </div>

          <AdminReportFilters
            value={adminFilters}
            options={filterOptions}
            loading={!filterOptions && loading}
            hideStatus={true}
            hideClearButton={true}
            onChange={handleAdminFiltersChange}
            onClearAll={handleClearAllAnalyticsFilters}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
            {/* <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-gray-200 !bg-gray-50 !text-gray-600">
              {dateRange.label}
            </Tag> */}
            {isAnyFilterActive && (
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

      <div className="relative space-y-6">
        {loading && data && (
          <div className="absolute -inset-4 z-10 rounded-2xl bg-white/50 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition-all duration-300">
            <Spin size="large" />
          </div>
        )}

        {/* 2-Column Grid: Utilization by Department & Compliance by Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <UtilizationByDepartment
            departments={data?.departmentUtilization}
            totalDepartments={data?.departmentSummary?.totalDepartments}
            activeDepartments={data?.departmentSummary?.activeDepartments}
          />
          <ComplianceByManager
            managers={data?.managerCompliance}
            summary={data?.managerComplianceSummary}
          />
        </div>

        <Card
          variant="borderless"
          className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          <div className="p-6 md:p-8">
            <WorkRhythm
              dailyActivity={data?.dailyActivity ?? []}
              hourlyActivity={data?.byHour ?? []}
              fromDate={dateRange.fromDate}
              toDate={dateRange.toDate}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

