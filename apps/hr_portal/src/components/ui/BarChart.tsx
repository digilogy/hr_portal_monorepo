"use client";

import React, { useMemo, useState } from "react";

interface BarDataPoint {
  label: string;
  value: number;
  secondaryValue?: string | number;
}

interface BarChartProps {
  data: BarDataPoint[];
  height?: number;
  color?: string;
  yAxisLabel?: string;
  threshold?: number;
}

export function BarChart({ 
  data, 
  height = 300, 
  color = "#2a78d6", 
  yAxisLabel = "",
  threshold
}: BarChartProps) {
  const padding = { top: 40, right: 20, bottom: 32, left: 50 };
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { max } = useMemo(() => {
    let m = 0;
    data.forEach(d => { if (d.value > m) m = d.value; });
    if (threshold !== undefined && threshold > m) m = threshold;
    m = Math.ceil(m * 1.2);
    if (m === 0) m = 100;
    return { max: m };
  }, [data, threshold]);

  const yRange = max;

  return (
    <div className="w-full relative" style={{ height }}>
      {/* Y-Axis labels and grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between" style={{ paddingBottom: padding.bottom, paddingTop: padding.top }}>
        {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((val, i) => (
          <div key={i} className="flex items-center w-full relative">
            <span className="w-10 text-right text-xs text-gray-400 absolute left-0 -translate-y-1/2">
              {val.toFixed(0)}{yAxisLabel}
            </span>
            <div className="w-full h-[1px] bg-gray-100 ml-12" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-end justify-between" style={{ left: padding.left, right: padding.right, top: padding.top, bottom: padding.bottom }}>
        {/* Threshold Line */}
        {threshold !== undefined && (
          <div 
            className="absolute left-0 w-full border-t border-dashed z-0 pointer-events-none" 
            style={{ 
              bottom: `${(threshold / yRange) * 100}%`,
              borderColor: "#52c41a",
              borderWidth: "1px"
            }}
          >
            <span className="absolute -top-4 right-0 text-[10px] text-[#52c41a] font-semibold">TARGET</span>
          </div>
        )}

        {/* Bars */}
        {data.map((d, i) => {
          const heightPct = (d.value / yRange) * 100;
          const isHovered = hoveredIndex === i;
          return (
            <div 
              key={i} 
              className="relative flex flex-col items-center justify-end group z-10"
              style={{ width: `${100 / data.length}%`, height: "100%" }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg z-50 animate-fade-in-up">
                  <div className="font-semibold">{d.label}</div>
                  <div>{d.value.toFixed(1)}{yAxisLabel}</div>
                  {d.secondaryValue && <div className="text-gray-300 text-[10px]">{d.secondaryValue}</div>}
                </div>
              )}
              
              <div 
                className="w-4/5 max-w-[40px] rounded-t-sm transition-all duration-300 relative overflow-hidden cursor-pointer"
                style={{ 
                  height: `${heightPct}%`, 
                  backgroundColor: isHovered ? `${color}dd` : color,
                  boxShadow: isHovered ? `0 4px 12px ${color}40` : "none"
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>

      {/* X-Axis labels */}
      <div className="absolute bottom-0 flex justify-between" style={{ left: padding.left, right: padding.right, height: padding.bottom }}>
        {data.map((d, i) => (
          <div 
            key={i} 
            className="flex items-start justify-center pt-2"
            style={{ width: `${100 / data.length}%` }}
          >
            <span className="text-[10px] text-gray-500 text-center leading-tight truncate px-1 max-w-full" title={d.label}>
              {d.label.length > 12 ? d.label.substring(0, 10) + '...' : d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
