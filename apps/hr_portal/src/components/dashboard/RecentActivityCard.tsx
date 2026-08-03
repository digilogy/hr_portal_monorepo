"use client";

import React from "react";
import { Button, Card, Empty, Tag, Typography } from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import type { DayActivity } from "@/lib/timesheetActivity";

const { Text } = Typography;

interface RecentActivityCardProps {
  activities: DayActivity[];
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
    badge: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-zinc-900 dark:text-gray-400 dark:border-zinc-700",
    bar: "bg-gray-300 dark:bg-zinc-600",
    tag: "default",
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

  return (
    <Link
      href="/timesheet"
      className="group block rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-4 transition-all hover:border-[#F5A623]/40 hover:shadow-sm"
    >
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
            {activity.timeRange && activity.isLogged && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <ClockCircleOutlined />
                {activity.timeRange}
              </span>
            )}
          </div>

          <p
            className={`text-sm leading-relaxed ${
              activity.isLogged
                ? "text-gray-600 dark:text-gray-300"
                : "italic text-gray-400"
            }`}
          >
            {activity.summary}
          </p>

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
              {activity.isLogged
                ? `${activity.progressPercent}% of 8h`
                : "Not started"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-end">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}
          >
            {activity.isLogged ? `${activity.totalHours}h logged` : "Pending"}
          </span>
          {activity.isLogged && (
            <span className="text-xs text-gray-400">
              {activity.taskCount} task{activity.taskCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  const loggedCount = activities.filter((item) => item.isLogged).length;

  return (
    <Card
      className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
      variant="borderless"
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-[#F5A623]" />
          <span>Recent Activity</span>
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
        {loggedCount > 0
          ? `${loggedCount} logged workday${loggedCount === 1 ? "" : "s"} this week`
          : "Your weekday timesheet activity for this week"}
      </Text>

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityRow key={activity.date} activity={activity} />
          ))}
        </div>
      ) : (
        <Empty description="No weekdays in the selected range.">
          <Link href="/timesheet">
            <Button type="primary">Start logging</Button>
          </Link>
        </Empty>
      )}
    </Card>
  );
}
