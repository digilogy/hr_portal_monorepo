"use client";

import React from "react";
import { Card, Typography } from "antd";

const { Text } = Typography;

interface DashboardMetricCardProps {
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
      className={`shadow-sm rounded-xl border h-full transition-all ${
        active
          ? "border-[#F5A623] ring-2 ring-[#F5A623]/20"
          : "border-gray-100 dark:border-zinc-800"
      } ${onClick ? "cursor-pointer hover:shadow-md" : "hover:shadow-md"}`}
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{title}</Text>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconClassName}`}
        >
          {icon}
        </div>
      </div>

      <div className="mb-3">
        <span className={`text-3xl font-bold ${valueClassName}`}>{valueLabel}</span>
        {targetLabel ? (
          <span className="ml-1.5 text-sm text-gray-400">{targetLabel}</span>
        ) : null}
      </div>

      {clampedPercent !== undefined ? (
        <>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 mb-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barClassName}`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          {(footerLeft || footerRight) && (
            <div className="flex items-center justify-between text-xs">
              {footerLeft ? (
                <span className="text-gray-500">{footerLeft}</span>
              ) : (
                <span />
              )}
              {footerRight ? (
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {footerRight}
                </span>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}
