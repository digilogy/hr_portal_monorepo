"use client";

import React from "react";

interface FilterFieldProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FilterField({
  label,
  icon,
  children,
  className = "",
}: FilterFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
