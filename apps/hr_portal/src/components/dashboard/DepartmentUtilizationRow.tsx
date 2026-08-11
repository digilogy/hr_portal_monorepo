"use client";

import React from "react";
import { RightOutlined, TeamOutlined } from "@ant-design/icons";

interface DepartmentUtilizationRowProps {
  department: string;
  avgUtilization: number;
  headcount: number;
  totalHours: number;
  onClick: () => void;
}

function getUtilizationStyles(pct: number) {
  if (pct >= 100) {
    return {
      text: "text-green-600",
      bar: "bg-green-500",
      badge: "bg-green-50 text-green-700 border-green-100",
    };
  }
  if (pct >= 90) {
    return {
      text: "text-blue-600",
      bar: "bg-blue-500",
      badge: "bg-blue-50 text-blue-700 border-blue-100",
    };
  }
  if (pct > 0) {
    return {
      text: "text-amber-600",
      bar: "bg-[#F5A623]",
      badge: "bg-amber-50 text-amber-700 border-amber-100",
    };
  }
  return {
    text: "text-gray-400",
    bar: "bg-gray-300",
    badge: "bg-gray-50 text-gray-500 border-gray-100",
  };
}

export function DepartmentUtilizationRow({
  department,
  avgUtilization,
  headcount,
  totalHours,
  onClick,
}: DepartmentUtilizationRowProps) {
  const styles = getUtilizationStyles(avgUtilization);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 transition-all hover:border-[#F5A623]/40 hover:shadow-md hover:shadow-[#F5A623]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623]/30"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-[#F5A623] transition-colors">
              {department}
            </span>
            <RightOutlined className="text-[10px] sm:text-xs text-gray-300 group-hover:text-[#F5A623] shrink-0 transition-colors" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <TeamOutlined />
              {headcount} employees
            </span>
            <span className="text-gray-300">·</span>
            <span>{totalHours} hrs logged</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold ${styles.badge}`}
        >
          {avgUtilization}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
          style={{ width: `${Math.min(avgUtilization, 100)}%` }}
        />
      </div>
    </button>
  );
}
