"use client";

import React from "react";
import { Card, Typography } from "antd";

const { Text } = Typography;

export interface DashboardMetricCardProps {
  title: string;
  valueLabel: string;
  targetLabel?: string;
  percent?: number;
  footerLeft?: string;
  footerRight?: string;
  icon: React.ReactNode;
  iconClassName: string;
  barClassName?: string;
  valueClassName?: string;
  percentClassName?: string;
  onClick?: () => void;
  active?: boolean;
}

export function DashboardMetricCard({
  title,
  valueLabel,
  targetLabel,
  percent,
  footerLeft,
  footerRight,
  icon,
  iconClassName,
  barClassName = "bg-[#F5A623]",
  valueClassName = "text-gray-900 dark:text-white",
  percentClassName,
  onClick,
  active = false,
}: DashboardMetricCardProps) {
  const clampedPercent =
    percent !== undefined ? Math.min(100, Math.max(0, percent)) : undefined;

  return (
    <Card
      variant="borderless"
      onClick={onClick}
      hoverable={!!onClick}
      className={`shadow-sm rounded-2xl border h-full transition-all [&>.ant-card-body]:!p-2 sm:[&>.ant-card-body]:!p-3 lg:[&>.ant-card-body]:!p-4 ${
        active
          ? "border-[#F5A623] ring-2 ring-[#F5A623]/20"
          : "border-gray-100 dark:border-zinc-800"
      } ${onClick ? "cursor-pointer hover:shadow-md" : "hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-4">
        <Text className="text-xs sm:text-sm md:text-base lg:text-lg font-medium leading-tight text-gray-900 dark:text-gray-100">
          {title}
        </Text>
        <div
          className={`flex h-7 w-7 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-xl ${iconClassName}`}
        >
          {icon}
        </div>
      </div>

      <div className="mb-2 sm:mb-4">
        <span className={`text-xl sm:text-3xl lg:text-4xl font-bold ${valueClassName}`}>{valueLabel}</span>
        {targetLabel ? (
          <span className="ml-1 sm:ml-2 text-[10px] sm:text-sm text-gray-400">{targetLabel}</span>
        ) : null}
      </div>

      {(clampedPercent !== undefined || footerLeft || footerRight) && (
        <>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 mb-2 sm:mb-3 overflow-hidden">
            {clampedPercent !== undefined ? (
              <div
                className={`h-full rounded-full transition-all duration-500 ${barClassName}`}
                style={{ width: `${clampedPercent}%` }}
              />
            ) : null}
          </div>
          {(footerLeft || footerRight) && (
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
              <span className="truncate mr-1 sm:mr-2">{footerLeft}</span>
              <span className={`font-semibold shrink-0 ${percentClassName || "text-gray-600 dark:text-gray-300"}`}>
                {footerRight}
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
