/**
 * @file TimeSpinnerInput.tsx
 * @description A 24-hour typeable time input component (00-23 Hour, 00-59 Minute)
 *              featuring autocomplete dropdown filtering while typing with a min-height menu,
 *              keyboard arrow navigation, and clean streamlined input field styling.
 */

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface TimeSpinnerInputProps {
  /** Value in 24-hour "HH:mm" format */
  value: string;
  /** Called with the new value in 24-hour "HH:mm" format */
  onChange: (value: string) => void;
  className?: string;
}

type Segment = "hour" | "minute";

const pad = (n: number): string => String(n).padStart(2, "0");

// Generate option lists for 24-hour format
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => pad(i));     // ["00", "01", ..., "23"]
const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));   // ["00", "01", ..., "59"]

const parseValue = (value: string): { hour: number; minute: number } => {
  if (!value || typeof value !== "string") return { hour: 0, minute: 0 };
  const clean = value.replace(/[^\d:]/g, "");
  const parts = clean.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return {
    hour: isNaN(h) ? 0 : Math.min(23, Math.max(0, h)),
    minute: isNaN(m) ? 0 : Math.min(59, Math.max(0, m)),
  };
};

export const TimeSpinnerInput: React.FC<TimeSpinnerInputProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const { hour, minute } = parseValue(value);

  const [hourStr, setHourStr] = useState<string>(pad(hour));
  const [minuteStr, setMinuteStr] = useState<string>(pad(minute));
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);

  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external value prop changes, unless user is actively editing that field
  useEffect(() => {
    if (activeSegment !== "hour") {
      setHourStr(pad(hour));
    }
  }, [value, hour, activeSegment]);

  useEffect(() => {
    if (activeSegment !== "minute") {
      setMinuteStr(pad(minute));
    }
  }, [value, minute, activeSegment]);

  const commitValue = useCallback(
    (newHour: number, newMinute: number) => {
      const clampedH = Math.min(23, Math.max(0, newHour));
      const clampedM = Math.min(59, Math.max(0, newMinute));
      onChange(`${pad(clampedH)}:${pad(clampedM)}`);
    },
    [onChange]
  );

  const increment = useCallback(
    (segment: Segment) => {
      if (segment === "hour") {
        const nextH = (hour + 1) % 24;
        setHourStr(pad(nextH));
        commitValue(nextH, minute);
      } else {
        const nextM = (minute + 1) % 60;
        setMinuteStr(pad(nextM));
        commitValue(hour, nextM);
      }
    },
    [hour, minute, commitValue]
  );

  const decrement = useCallback(
    (segment: Segment) => {
      if (segment === "hour") {
        const prevH = (hour - 1 + 24) % 24;
        setHourStr(pad(prevH));
        commitValue(prevH, minute);
      } else {
        const prevM = (minute - 1 + 60) % 60;
        setMinuteStr(pad(prevM));
        commitValue(hour, prevM);
      }
    },
    [hour, minute, commitValue]
  );

  // Filtered dropdown options based on what user typed
  const filteredHours = ALL_HOURS.filter((h) => {
    if (!hourStr) return true;
    return h.includes(hourStr) || parseInt(h, 10) === parseInt(hourStr, 10);
  });

  const filteredMinutes = ALL_MINUTES.filter((m) => {
    if (!minuteStr) return true;
    return m.includes(minuteStr);
  });

  const displayHours = filteredHours.length > 0 ? filteredHours : ALL_HOURS;
  const displayMinutes = filteredMinutes.length > 0 ? filteredMinutes : ALL_MINUTES;

  // Handle Hour typing in 24h mode
  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHourStr(raw);

    if (raw === "") return;

    let num = parseInt(raw, 10);
    if (isNaN(num)) return;
    if (num > 23) num = 23;

    commitValue(num, minute);

    // Auto advance if 2 digits entered or single digit >= 3
    if (raw.length === 2 || num >= 3) {
      setHourStr(pad(num));
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  // Handle Minute typing
  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinuteStr(raw);

    if (raw === "") return;

    let num = parseInt(raw, 10);
    if (isNaN(num)) return;
    if (num > 59) num = 59;

    commitValue(hour, num);

    if (raw.length === 2) {
      setMinuteStr(pad(num));
    }
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      increment("hour");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrement("hour");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      increment("minute");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrement("minute");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    } else if (e.key === "Backspace" && minuteStr === "") {
      e.preventDefault();
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    }
  };

  const handleWheel = (e: React.WheelEvent, segment: Segment) => {
    e.preventDefault();
    if (e.deltaY < 0) increment(segment);
    else decrement(segment);
  };

  const handleBlurContainer = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setActiveSegment(null);
      setHourStr(pad(hour));
      setMinuteStr(pad(minute));
    }
  };

  const selectHourOption = (hStr: string) => {
    const num = parseInt(hStr, 10);
    setHourStr(pad(num));
    commitValue(num, minute);
    minuteInputRef.current?.focus();
    minuteInputRef.current?.select();
  };

  const selectMinuteOption = (mStr: string) => {
    const num = parseInt(mStr, 10);
    setMinuteStr(pad(num));
    commitValue(hour, num);
    setActiveSegment(null);
  };

  return (
    <div
      ref={containerRef}
      onBlur={handleBlurContainer}
      className={`relative flex items-center justify-center rounded-xl border bg-gray-50/80 dark:bg-zinc-900/60 px-3 py-2 transition-all ${
        activeSegment
          ? "border-[#F5A623] ring-2 ring-[#F5A623]/25 bg-white dark:bg-zinc-900"
          : "border-gray-200 dark:border-zinc-700"
      } ${className}`}
    >
      <div className="flex items-center justify-center gap-1.5 font-mono text-sm">
        {/* Hour Input Container */}
        <div className="relative flex items-center justify-center">
          <input
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            aria-label="Hour"
            placeholder="HH"
            value={hourStr}
            onChange={handleHourChange}
            onKeyDown={handleHourKeyDown}
            onFocus={() => {
              setActiveSegment("hour");
              setHourStr("");
            }}
            onWheel={(e) => handleWheel(e, "hour")}
            className={`w-7 text-center bg-transparent border-0 outline-none p-0.5 font-mono text-sm rounded transition-colors placeholder:text-gray-300 dark:placeholder:text-zinc-600 ${
              activeSegment === "hour"
                ? "bg-[#F5A623]/15 text-[#B45309] dark:text-[#F5A623] font-bold"
                : "text-gray-900 dark:text-gray-100 hover:bg-gray-200/60 dark:hover:bg-zinc-800"
            }`}
          />

          {/* Hour Dropdown Menu - straight beneath Hour field */}
          {activeSegment === "hour" && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-16 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl z-[110] p-1 min-h-[120px] max-h-[180px] overflow-y-auto custom-scrollbar animate-fade-in">
              {displayHours.map((hOpt) => (
                <button
                  key={hOpt}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectHourOption(hOpt);
                  }}
                  className={`w-full text-center px-1 py-1 text-xs font-mono rounded-lg transition-colors flex items-center justify-center ${
                    parseInt(hOpt, 10) === hour
                      ? "bg-[#F5A623] text-[#F5A623] font-bold"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{hOpt}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="select-none font-bold text-gray-400">:</span>

        {/* Minute Input Container */}
        <div className="relative flex items-center justify-center">
          <input
            ref={minuteInputRef}
            type="text"
            inputMode="numeric"
            aria-label="Minute"
            placeholder="MM"
            value={minuteStr}
            onChange={handleMinuteChange}
            onKeyDown={handleMinuteKeyDown}
            onFocus={() => {
              setActiveSegment("minute");
              setMinuteStr("");
            }}
            onWheel={(e) => handleWheel(e, "minute")}
            className={`w-7 text-center bg-transparent border-0 outline-none p-0.5 font-mono text-sm rounded transition-colors placeholder:text-gray-300 dark:placeholder:text-zinc-600 ${
              activeSegment === "minute"
                ? "bg-[#F5A623]/15 text-[#B45309] dark:text-[#F5A623] font-bold"
                : "text-gray-900 dark:text-gray-100 hover:bg-gray-200/60 dark:hover:bg-zinc-800"
            }`}
          />

          {/* Minute Dropdown Menu - straight beneath Minute field */}
          {activeSegment === "minute" && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-16 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-xl z-[110] p-1 min-h-[120px] max-h-[180px] overflow-y-auto custom-scrollbar animate-fade-in">
              {displayMinutes.map((mOpt) => (
                <button
                  key={mOpt}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMinuteOption(mOpt);
                  }}
                  className={`w-full text-center px-1 py-1 text-xs font-mono rounded-lg transition-colors flex items-center justify-center ${
                    parseInt(mOpt, 10) === minute
                      ? "bg-[#F5A623] text-white font-bold"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{mOpt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
