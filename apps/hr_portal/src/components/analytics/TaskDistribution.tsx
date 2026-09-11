"use client";

import React, { useMemo } from "react";
import { Card, Typography, Empty, Progress } from "antd";

const { Title, Text } = Typography;

interface DistributionItem {
  category: string;
  hours: number;
  percentage: number;
  rate: number;
}

interface TaskDistributionProps {
  distribution: DistributionItem[];
}

export const CATEGORY_COLORS: Record<string, string> = {
  "HR Meeting": "#9333ea", // purple
  "HR Activity": "#d946ef", // fuchsia
  "IT Sync": "#2563eb", // blue
  "IT Support": "#06b6d4", // cyan
  "General Meeting": "#f59e0b", // amber
  "Development": "#10b981", // emerald
  "Travel": "#eab308", // yellow
  "BAU": "#64748b", // slate
  "Lunch": "#84cc16", // lime
  "Other": "#94a3b8", // slate-400
};

export function TaskDistribution({ distribution }: TaskDistributionProps) {
  const hasData = distribution && distribution.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {distribution.map((item) => (
        <Card
          key={item.category}
          variant="borderless"
          className="shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden"
          styles={{ body: { padding: 16 } }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"] }}
                />
                <Text className="font-semibold text-gray-800 dark:text-zinc-100">
                  {item.category}
                </Text>
              </div>
              <div className="text-gray-900 dark:text-gray-100 font-medium">
                {(() => {
                  const h = Math.floor(item.hours);
                  const m = Math.round((item.hours - h) * 60);
                  if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
                  if (h > 0) return `${h}hrs`;
                  if (m > 0) return `${m}mins`;
                  return "0hrs";
                })()}
              </div>
            </div>
            
            <Progress
              percent={item.percentage}
              showInfo={false}
              strokeColor={CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"]}
              railColor="rgba(0,0,0,0.05)"
              size="small"
              className="!m-0"
            />
            
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{item.percentage}% of total</span>
              <span>Rate: {item.rate}%</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
