"use client";

import React, { useState } from "react";
import { Button, Card, Empty, Tag, Typography, Tooltip, Pagination } from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import type { DayActivity } from "@/lib/timesheetActivity";
import { fmtHours } from "@/lib/formatHours";

const { Text } = Typography;

export type ActivityFilterType = "all" | "logged" | "pending";

interface RecentActivityCardProps {
  activities: DayActivity[];
  periodLabel?: string;
  activeFilter?: ActivityFilterType;
  onFilterChange?: (filter: ActivityFilterType) => void;
}

const STATUS_STYLES: Record<
  DayActivity["status"],
  { badge: string; bar: string; tag: string }
> = {
  complete: {
    badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    bar: "bg-green-500",
    tag: "green",
  },
  partial: {
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    bar: "bg-amber-500",
    tag: "gold",
  },
  low: {
    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
    bar: "bg-orange-500",
    tag: "orange",
  },
  pending: {
    badge: "bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    bar: "bg-amber-400 dark:bg-amber-500",
    tag: "warning",
  },
};

const TYPE_COLORS: Record<string, string> = {
  Meeting: "blue",
  Lunch: "green",
  Travel: "gold",
  Break: "magenta",
  BAU: "cyan",
  Custom: "default",
};

function ActivityRow({ activity }: { activity: DayActivity }) {
  const styles = STATUS_STYLES[activity.status];
  const isEditable = activity.isEditable !== false;
  const targetUrl = `/timesheet?date=${activity.date}`;

  const rowContent = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Text className="font-semibold text-gray-900 dark:text-gray-100">
            {activity.dateLabel}
          </Text>
          {activity.isToday && (
            <Tag color="orange" className="!m-0 !text-[10px] !leading-5">
              Today
            </Tag>
          )}
          {!activity.isLogged && isEditable && (
            <Tag color="volcano" className="!m-0 !text-[10px] !leading-5">
              Missing Entry
            </Tag>
          )}
          {!activity.isLogged && !isEditable && (
            <Tag color="default" className="!m-0 !text-[10px] !leading-5 flex items-center gap-1">
              <LockOutlined /> Edit Expired
            </Tag>
          )}
          {activity.timeRange && activity.isLogged && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <ClockCircleOutlined />
              {activity.timeRange}
            </span>
          )}
        </div>

        {activity.summary && (
          <p
            className={`text-sm leading-relaxed ${activity.isLogged
                ? "text-gray-600 dark:text-gray-300"
                : "italic text-amber-700/80 dark:text-amber-400/90 font-medium"
              }`}
          >
            {activity.summary}
          </p>
        )}

        {activity.highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activity.highlights.map((label) => (
              <Tag
                key={`${activity.date}-${label}`}
                color={TYPE_COLORS[label]}
                className="!m-0 !rounded-full !text-[11px]"
              >
                {label}
              </Tag>
            ))}
            {activity.taskCount > activity.highlights.length && (
              <Tag className="!m-0 !rounded-full !text-[11px]">
                +{activity.taskCount - activity.highlights.length} more
              </Tag>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${styles.bar}`}
              style={{ width: `${activity.progressPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-gray-400">
            {activity.progressPercent > 0
              ? `${activity.progressPercent}% of ${fmtHours(activity.targetHours ?? 8.5)}`
              : "0% logged"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-end">
        {activity.isLogged ? (
          <>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}
            >
              {fmtHours(activity.totalHours)} logged
            </span>
            <span className="text-xs text-gray-400">
              {activity.taskCount} task{activity.taskCount === 1 ? "" : "s"}
            </span>
          </>
        ) : isEditable ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 dark:bg-amber-900/50 dark:border-amber-700 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200 group-hover:bg-amber-200 transition-colors">
            <PlusOutlined /> Log Timesheet
          </span>
        ) : (
          <Tooltip title="Edit window expired. Only today and the last working day can be edited.">
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 px-3 py-1 text-xs font-semibold cursor-not-allowed">
              <LockOutlined /> Locked (No Edit Access)
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  );

  const containerClasses = `group block rounded-2xl border p-4 transition-all ${activity.isLogged
      ? "border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 hover:border-[#F5A623]/40"
      : isEditable
        ? "border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400"
        : "border-gray-200/60 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 opacity-80"
    }`;

  if (!activity.isLogged && !isEditable) {
    return <div className={containerClasses}>{rowContent}</div>;
  }

  return (
    <Link href={targetUrl} className={containerClasses}>
      {rowContent}
    </Link>
  );
}

export function RecentActivityCard({
  activities,
  periodLabel,
  activeFilter = "all",
  onFilterChange,
}: RecentActivityCardProps) {
  const [internalFilter, setInternalFilter] = useState<ActivityFilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const currentFilter = onFilterChange ? activeFilter : internalFilter;

  const handleFilterChange = (val: ActivityFilterType) => {
    setCurrentPage(1);
    if (onFilterChange) {
      onFilterChange(val);
    } else {
      setInternalFilter(val);
    }
  };

  const loggedCount = activities.filter((item) => item.isLogged).length;
  const pendingCount = activities.filter((item) => !item.isLogged).length;

  const filteredActivities = activities.filter((item) => {
    if (currentFilter === "logged") return item.isLogged;
    if (currentFilter === "pending") return !item.isLogged;
    return true;
  });

  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <Card
      className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
      variant="borderless"
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-[#F5A623]" />
          <span>{periodLabel ? `Timesheet Activity · ${periodLabel}` : "Recent Activity"}</span>
        </div>
      }
      extra={
        <Link href="/timesheet">
          <Button type="link" icon={<ArrowRightOutlined />} iconPlacement="end" className="!px-0">
            Open timesheet
          </Button>
        </Link>
      }
    >
      <Text className="mb-4 block text-sm text-gray-500">
        {currentFilter === "pending"
          ? `${pendingCount} unsubmitted workday${pendingCount === 1 ? "" : "s"} requiring timesheet entry`
          : currentFilter === "logged"
            ? `${loggedCount} completed workday${loggedCount === 1 ? "" : "s"}`
            : `${loggedCount} of ${activities.length} workdays logged in selected period`}
      </Text>

      {filteredActivities.length > 0 ? (
        <div className="space-y-3">
          {paginatedActivities.map((activity) => (
            <ActivityRow key={activity.date} activity={activity} />
          ))}
          {filteredActivities.length > pageSize && (
            <div className="flex justify-center mt-4">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredActivities.length}
                onChange={(page) => setCurrentPage(page)}
                size="small"
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      ) : (
        <Empty
          description={
            currentFilter === "pending"
              ? "All workdays are up to date! No pending submissions."
              : currentFilter === "logged"
                ? "No logged entries found for this period."
                : "No workdays in the selected range."
          }
        >
          {activities.length > 0 && currentFilter !== "pending" && (
            <Link href="/timesheet">
              <Button type="primary">Start logging</Button>
            </Link>
          )}
        </Empty>
      )}
    </Card>
  );
}

