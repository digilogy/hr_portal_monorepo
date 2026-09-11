"use client";

import React from "react";

interface BarDataPoint {
  label: string;
  value: number;
  secondaryValue?: string | number;
}

interface HorizontalBarChartProps {
  data: BarDataPoint[];
  threshold?: number;
  unitSuffix?: string;
  color?: string;
  onBarClick?: (label: string) => void;
}

function getBarColor(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 90) return "#3b82f6";
  if (pct > 0) return "#F5A623";
  return "#d1d5db";
}

export function HorizontalBarChart({
  data,
  threshold,
  unitSuffix = "h",
  color = "#F5A623",
  onBarClick,
}: HorizontalBarChartProps) {
  if (!data.length) return null;

  const maxValue = Math.max(
    ...data.map((d) => d.value),
    threshold ?? 0,
    1,
  );

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const widthPct = Math.min((d.value / maxValue) * 100, 100);
        const thresholdPct =
          threshold !== undefined ? (threshold / maxValue) * 100 : null;
        const barColor = threshold !== undefined ? getBarColor(d.value) : d.value > 0 ? color : "#d1d5db";
        const clickable = !!onBarClick;

        return (
          <div
            key={d.label}
            className={`group flex items-center gap-3 ${clickable ? "cursor-pointer" : ""}`}
            onClick={() => onBarClick?.(d.label)}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onBarClick?.(d.label);
                    }
                  }
                : undefined
            }
          >
            <span
              className="w-28 sm:w-36 shrink-0 text-sm text-gray-700 dark:text-gray-200 truncate font-medium group-hover:text-[#F5A623] transition-colors"
              title={d.label}
            >
              {d.label}
            </span>

            <div className="relative flex-1 h-7 rounded-md bg-gray-100 dark:bg-zinc-800 overflow-hidden">
              {thresholdPct !== null && thresholdPct <= 100 && (
                <div
                  className="absolute top-0 bottom-0 border-l border-dashed border-green-500/70 z-10 pointer-events-none"
                  style={{ left: `${thresholdPct}%` }}
                />
              )}
              <div
                className="h-full rounded-md transition-all duration-500 relative overflow-hidden"
                style={{ width: `${widthPct}%`, backgroundColor: barColor }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
              </div>
            </div>

            <div className="w-14 shrink-0 text-right">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {(() => {
                  if (unitSuffix === "h") {
                    const h = Math.floor(d.value);
                    const m = Math.round((d.value - h) * 60);
                    if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
                    if (h > 0) return `${h}hrs`;
                    if (m > 0) return `${m}mins`;
                    return "0hrs";
                  }
                  return `${d.value.toFixed(1)}${unitSuffix}`;
                })()}
              </span>
              {d.secondaryValue !== undefined && (
                <div className="text-[10px] text-gray-400 truncate" title={String(d.secondaryValue)}>
                  {d.secondaryValue}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {threshold !== undefined && (
        <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-green-600 font-semibold">
          <span className="inline-block w-4 border-t border-dashed border-green-500" />
          Target {threshold}
          {unitSuffix}
        </div>
      )}
    </div>
  );
}
