"use client";

import React, { useMemo, useRef, useState } from "react";

interface DataPoint {
  label: string;
  [key: string]: string | number | null;
}

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
}

interface TrendChartProps {
  data: DataPoint[];
  series: SeriesConfig[];
  height?: number;
  /** Reference/target line, e.g. a utilization goal */
  threshold?: number;
  thresholdLabel?: string;
  /** Appended to axis ticks, endpoint labels, and tooltip values, e.g. "%" */
  unitSuffix?: string;
  /** Max x-axis labels to render (remaining ticks are hidden to avoid overlap) */
  maxXLabels?: number;
}

interface Pt {
  x: number;
  y: number;
  val: number | null;
}

const GRID_COLOR = "rgba(148,163,184,0.22)";
const TARGET_COLOR = "#0ca30c";

export function TrendChart({
  data,
  series,
  height = 320,
  threshold,
  thresholdLabel = "Target",
  unitSuffix = "",
  maxXLabels = 8,
}: TrendChartProps) {
  const padding = { top: 36, right: 40, bottom: 32, left: 34 };
  const plotRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const xLabelStep = useMemo(() => {
    if (data.length <= maxXLabels) return 1;
    return Math.ceil(data.length / maxXLabels);
  }, [data.length, maxXLabels]);

  const shouldShowXLabel = (index: number) =>
    index === 0 || index === data.length - 1 || index % xLabelStep === 0;

  const { min, max } = useMemo(() => {
    let lo = 0;
    let hi = 0;
    data.forEach((d) => {
      series.forEach((s) => {
        const val = d[s.key];
        if (typeof val !== "number") return;
        if (val > hi) hi = val;
        if (val < lo) lo = val;
      });
    });
    if (threshold !== undefined && threshold > hi) hi = threshold;
    if (threshold !== undefined && threshold < lo) lo = threshold;
    const rawMax = hi * 1.15 || 1;
    const step = rawMax <= 3 ? 0.1 : rawMax <= 20 ? 1 : rawMax <= 100 ? 5 : 10;
    hi = Math.ceil(rawMax / step) * step;
    return { min: lo, max: hi };
  }, [data, series, threshold]);

  const yRange = max - min || 1;

  const pointsBySeries = useMemo(() => {
    const result: Record<string, Pt[]> = {};
    series.forEach((s) => {
      result[s.key] = data.map((d, i) => {
        const raw = d[s.key];
        const val = typeof raw === "number" ? raw : null;
        const x = (i / Math.max(data.length - 1, 1)) * 100;
        const y = val === null ? NaN : 100 - ((val - min) / yRange) * 100;
        return { x, y, val };
      });
    });
    return result;
  }, [data, series, min, yRange]);

  // Split each series into contiguous runs so gaps (months without data yet) break the line
  const segmentsBySeries = useMemo(() => {
    const result: Record<string, Pt[][]> = {};
    series.forEach((s) => {
      const pts = pointsBySeries[s.key];
      const segments: Pt[][] = [];
      let current: Pt[] = [];
      pts.forEach((pt) => {
        if (pt.val === null) {
          if (current.length) segments.push(current);
          current = [];
        } else {
          current.push(pt);
        }
      });
      if (current.length) segments.push(current);
      result[s.key] = segments;
    });
    return result;
  }, [pointsBySeries, series]);

  const lastPointBySeries = useMemo(() => {
    const result: Record<string, Pt | null> = {};
    series.forEach((s) => {
      const pts = pointsBySeries[s.key];
      let last: Pt | null = null;
      for (const pt of pts) {
        if (pt.val !== null) last = pt;
      }
      result[s.key] = last;
    });
    return result;
  }, [pointsBySeries, series]);

  const spline = (pts: Pt[]) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const dx = (p1.x - p0.x) * 0.4;
      d += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const splineArea = (pts: Pt[]) => {
    if (pts.length === 0) return "";
    const lastX = pts[pts.length - 1].x;
    const firstX = pts[0].x;
    return `${spline(pts)} L ${lastX} 100 L ${firstX} 100 Z`;
  };

  const thresholdY =
    threshold !== undefined ? 100 - ((threshold - min) / yRange) * 100 : null;

  const yTicks = [max, max * 0.75, max * 0.5, max * 0.25, min];
  const fmtTick = (v: number) =>
    `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}${unitSuffix}`;
  const fmtVal = (v: number) => {
    if (unitSuffix === "h") {
      const h = Math.floor(v);
      const m = Math.round((v - h) * 60);
      if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
      if (h > 0) return `${h}hrs`;
      if (m > 0) return `${m}mins`;
      return "0hrs";
    }
    return `${v.toFixed(1)}${unitSuffix}`;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const fraction = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(fraction * (data.length - 1));
    setHoverIndex(Math.min(Math.max(idx, 0), data.length - 1));
  };

  const hoverPct =
    hoverIndex !== null ? (hoverIndex / Math.max(data.length - 1, 1)) * 100 : null;
  const tooltipTransform =
    hoverPct === null ? undefined : hoverPct < 14 ? "translateX(0%)" : hoverPct > 86 ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div className="premium-trend-chart w-full">
      {/* Legend — line-key swatches, text stays in neutral ink */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-5 gap-y-2 mb-4 px-1">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-zinc-400">
            <span
              className="inline-block w-4 h-[2.5px] rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </div>
        ))}
      </div>

      <div className="w-full relative" style={{ height }}>
        {/* Gridlines + Y-axis labels */}
        <div
          className="absolute inset-0 flex flex-col justify-between"
          style={{ paddingBottom: padding.bottom, paddingTop: padding.top }}
        >
          {yTicks.map((val, i) => (
            <div key={i} className="flex items-center w-full relative">
              <span className="w-7 text-right text-[11px] tabular-nums text-gray-400 dark:text-zinc-500 absolute left-0 -translate-y-1/2">
                {fmtTick(val)}
              </span>
              <div
                className="w-full h-px ml-9"
                style={{ backgroundColor: GRID_COLOR }}
              />
            </div>
          ))}
        </div>

        <div
          ref={plotRef}
          className="absolute inset-0"
          style={{
            left: padding.left,
            right: padding.right,
            top: padding.top,
            bottom: padding.bottom,
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${series.map((s) => s.name).join(", ")} line chart from ${data[0]?.label} to ${data[data.length - 1]?.label}`}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            {thresholdY !== null && (
              <line
                x1="0"
                y1={thresholdY}
                x2="100"
                y2={thresholdY}
                stroke={TARGET_COLOR}
                strokeWidth="0.5"
                strokeDasharray="1.5,1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {hoverPct !== null && (
              <line
                x1={hoverPct}
                y1="0"
                x2={hoverPct}
                y2="100"
                stroke="currentColor"
                className="text-gray-300 dark:text-zinc-600"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {series.map((s) =>
              segmentsBySeries[s.key].map((seg, si) => (
                <g key={`${s.key}-${si}`}>
                  <path d={splineArea(seg)} fill={`url(#grad-${s.key})`} />
                  <path
                    d={spline(seg)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )),
            )}
          </svg>

          {/* Endpoint markers + direct labels (selective — only the final data point per series) */}
          <div className="absolute inset-0 pointer-events-none">
            {series.map((s) => {
              const last = lastPointBySeries[s.key];
              if (!last) return null;
              return (
                <div
                  key={s.key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${last.x}%`, top: `${last.y}%` }}
                >
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 text-[11px] font-semibold tabular-nums text-gray-700 dark:text-zinc-200 whitespace-nowrap">
                    {last.val !== null ? fmtVal(last.val) : ""}
                  </span>
                  <span
                    className="block rounded-full border-2 border-white dark:border-zinc-900 shadow-sm"
                    style={{ width: 9, height: 9, backgroundColor: s.color }}
                  />
                </div>
              );
            })}

            {/* Hover markers at the crosshair position */}
            {hoverIndex !== null &&
              series.map((s) => {
                const pt = pointsBySeries[s.key][hoverIndex];
                if (!pt || pt.val === null) return null;
                return (
                  <div
                    key={`hover-${s.key}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                  >
                    <span
                      className="block rounded-full border-2 border-white dark:border-zinc-900 shadow"
                      style={{ width: 8, height: 8, backgroundColor: s.color }}
                    />
                  </div>
                );
              })}
          </div>

          {threshold !== undefined && thresholdY !== null && (
            <div
              className="absolute right-0 text-[10px] font-semibold uppercase tracking-wide pointer-events-none"
              style={{ top: `${thresholdY}%`, color: TARGET_COLOR, transform: "translateY(-140%)" }}
            >
              {thresholdLabel}
            </div>
          )}

          {/* Tooltip */}
          {hoverIndex !== null && hoverPct !== null && (
            <div
              className="absolute z-10 pointer-events-none rounded-lg border border-gray-100 dark:border-zinc-700 bg-white/95 dark:bg-zinc-800/95 shadow-lg backdrop-blur px-3 py-2 min-w-[128px]"
              style={{
                left: `${hoverPct}%`,
                top: -8,
                transform: tooltipTransform,
              }}
            >
              <div className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 mb-1.5">
                {data[hoverIndex]?.label}
              </div>
              <div className="flex flex-col gap-1">
                {series.map((s) => {
                  const val = pointsBySeries[s.key][hoverIndex]?.val;
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                        <span
                          className="inline-block w-2.5 h-[2px] rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-800 dark:text-zinc-100">
                        {val === null || val === undefined ? "—" : fmtVal(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div
          className="absolute bottom-0 left-0 w-full flex justify-between pb-3"
          style={{ paddingLeft: padding.left, paddingRight: padding.right }}
        >
          {data.map((d, i) => {
            const hasAnyData = series.some((s) => typeof d[s.key] === "number");
            const showLabel = shouldShowXLabel(i);
            return (
              <div
                key={i}
                className={`text-[11px] text-center -translate-x-1/2 whitespace-nowrap ${
                  hasAnyData ? "text-gray-500 dark:text-zinc-400" : "text-gray-300 dark:text-zinc-600"
                }`}
                style={{ width: 0 }}
              >
                {showLabel ? d.label : ""}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
