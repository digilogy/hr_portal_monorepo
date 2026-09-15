"use client";

import React from "react";

interface FilterClearIconProps {
  size?: number;
  className?: string;
}

export function FilterClearIcon({ size = 24, className = "" }: FilterClearIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {/* Light Orange Background */}
      <rect width="24" height="24" rx="6" fill="#FFF4E5" stroke="#FDBA74" strokeWidth="1" />

      {/* White Funnel Filter with Orange Accent Stroke */}
      <path
        d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5C20 5.27407 19.8876 5.53582 19.6885 5.72378L13.8 11.2857V17.3787C13.8 17.6439 13.6946 17.8983 13.5071 18.0858L11.5071 20.0858C11.0524 20.5405 10.25 20.2188 10.25 19.5787V11.2857L4.31154 5.72378C4.11244 5.53582 4 5.27407 4 5Z"
        fill="#FFFFFF"
        stroke="#F5A623"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Red Cross Badge on Bottom Right */}
      <circle cx="17" cy="17" r="4.8" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.2" />
      <path
        d="M15.3 15.3L18.7 18.7M18.7 15.3L15.3 18.7"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
