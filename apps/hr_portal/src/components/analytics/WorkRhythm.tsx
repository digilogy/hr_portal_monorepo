"use client";

import React, { useMemo } from "react";
import dayjs from "dayjs";
import { Empty, Tag } from "antd";
import { BarChart } from "@/components/ui/BarChart";
import { TrendChart } from "@/components/ui/TrendChart";
import {
  aggregateActivityForCharts,
  aggregateHourlyForCharts,
  getChartCopy,
  getChartGranularity,
  getGranularityHint,
  getGranularityLabel,
  type DayActivity,
  type HourActivity,
} from "@/lib/analyticsGrouping";

const BRAND_PRIMARY = "#F5A623";

interface WorkRhythmProps {
  dailyActivity: DayActivity[];
  hourlyActivity?: HourActivity[];
  fromDate: string;
  toDate: string;
}

export function WorkRhythm({
  dailyActivity,
  hourlyActivity = [],
  fromDate,
  toDate,
}: WorkRhythmProps) {
  const range = useMemo(
    () => ({
      from: dayjs(fromDate),
      to: dayjs(toDate),
    }),
    [fromDate, toDate],
  );

  const granularity = useMemo(
    () => getChartGranularity(range.from, range.to),
    [range.from, range.to],
  );

  const granularityHint = useMemo(
    () => getGranularityHint(range.from, range.to),
    [range.from, range.to],
  );

  const chartPoints = useMemo(() => {
    if (granularity === "hourly") {
      return aggregateHourlyForCharts(hourlyActivity);
    }
    return aggregateActivityForCharts(dailyActivity, range.from, range.to, granularity);
  }, [granularity, hourlyActivity, dailyActivity, range.from, range.to]);

  const copy = getChartCopy(granularity);

  const barChartData = useMemo(
    () =>
      chartPoints.map((point) => ({
        label: point.shortLabel,
        value: point.hours,
        secondaryValue: point.secondaryValue,
      })),
    [chartPoints],
  );

  const trendData = useMemo(
    () =>
      chartPoints.map((point) => ({
        label: point.shortLabel,
        hours: point.hours,
      })),
    [chartPoints],
  );

  const hasData = chartPoints.some((point) => point.hours > 0);
  const useScrollableBars = chartPoints.length > 31;

  if (!hasData) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No activity recorded for this period."
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-[#F5A623]/30 !bg-[#F5A623]/10 !text-[#c4841a] font-medium">
          {getGranularityLabel(granularity)}
        </Tag>
        <span className="text-xs text-gray-400">{granularityHint}</span>
      </div>

      <div>
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
            {copy.barTitle}
          </h5>
          <p className="text-xs text-gray-400">{copy.barDescription}</p>
        </div>
        <div className={useScrollableBars ? "overflow-x-auto custom-scrollbar pb-1" : ""}>
          <div style={{ minWidth: useScrollableBars ? chartPoints.length * 48 : undefined }}>
            <BarChart
              data={barChartData}
              height={280}
              color={BRAND_PRIMARY}
              yAxisLabel="h"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
            {copy.trendTitle}
          </h5>
          <p className="text-xs text-gray-400">{copy.trendDescription}</p>
        </div>
        <TrendChart
          data={trendData}
          series={[{ key: "hours", name: "Hours logged", color: BRAND_PRIMARY }]}
          height={300}
          unitSuffix="h"
          maxXLabels={granularity === "hourly" ? 24 : granularity === "daily" ? 10 : 12}
        />
      </div>
    </div>
  );
}
