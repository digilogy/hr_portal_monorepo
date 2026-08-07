"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import {
  TimesheetColumnView,
  HistoricalDay,
  TimesheetDayView,
} from "@/components/ui/TimesheetColumnView";
import { TimeSlotData } from "@/components/ui/TimesheetGrid";
import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { message, DatePicker } from "antd";
import { apiFetch } from "@/lib/api";

const CONFIG = {
  START_HOUR: 8,
  START_MINUTE: 30,
};

const formatTime = (hour: number, minute: number) => {
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const displayMinute = minute === 0 ? "00" : minute.toString();
  return `${displayHour}:${displayMinute} ${ampm}`;
};

const generateTimeSlots = (): TimeSlotData[] => [
  {
    key: `${CONFIG.START_HOUR}:${CONFIG.START_MINUTE}`,
    timeSlot: `${formatTime(CONFIG.START_HOUR, CONFIG.START_MINUTE)} - ${formatTime(CONFIG.START_HOUR + 1, CONFIG.START_MINUTE)}`,
    title: "",
    task: "",
  },
];

interface TimesheetRecord {
  id: number;
  date: string;
  slots: TimeSlotData[];
  totalHours: number;
}

function toHistoricalDay(record: TimesheetRecord): HistoricalDay {
  return {
    dateStr: dayjs(record.date).format("MMM D, YYYY"),
    totalHours: record.totalHours,
    tasks: record.slots
      .filter((slot) => slot.task.trim())
      .map((slot) => ({
        timeSlot: slot.timeSlot,
        title: slot.title,
        task: slot.task,
        taskType: slot.taskType,
      })),
  };
}

export default function Timesheet2Page() {
  const [messageApi, contextHolder] = message.useMessage();
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [dataStore, setDataStore] = useState<Record<string, TimeSlotData[]>>({});
  const [historyData, setHistoryData] = useState<HistoricalDay[]>([]);
  const [loading, setLoading] = useState(true);

  const currentKey = currentDate.format("YYYY-MM-DD");
  const data = dataStore[currentKey] ?? generateTimeSlots();
  const isPastDate = currentDate.isBefore(dayjs(), "day");
  const isReadOnly = isPastDate;

  const columnDays = useMemo((): TimesheetDayView[] => {
    const historyDays = historyData.map((day) => ({
      dateKey: day.dateStr,
      dateStr: day.dateStr,
      totalHours: day.totalHours,
      slots: day.tasks.map((task, index) => ({
        key: `${day.dateStr}-${index}`,
        timeSlot: task.timeSlot,
        title: task.title || "",
        task: task.task,
        taskType: task.taskType,
      })),
      isToday: false,
    }));

    return [
      {
        dateKey: currentKey,
        dateStr: currentDate.format("MMM D, YYYY"),
        totalHours: 0,
        slots: data,
        isToday: currentDate.isSame(dayjs(), "day"),
      },
      ...historyDays,
    ];
  }, [currentDate, currentKey, data, historyData]);

  const loadHistory = useCallback(async (excludeDate: string) => {
    const entries = await apiFetch<TimesheetRecord[]>(
      `/api/timesheets/history?excludeDate=${excludeDate}&limit=30`,
    );
    setHistoryData(entries.map(toHistoricalDay));
  }, []);

  const loadDay = useCallback(
    async (dateKey: string) => {
      setLoading(true);
      try {
        const entry = await apiFetch<TimesheetRecord | null>(
          `/api/timesheets/day/${dateKey}`,
        );
        setDataStore((prev) => ({
          ...prev,
          [dateKey]: entry?.slots?.length ? entry.slots : generateTimeSlots(),
        }));
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Failed to load timesheet";
        messageApi.error(errMsg);
        setDataStore((prev) => ({
          ...prev,
          [dateKey]: prev[dateKey] ?? generateTimeSlots(),
        }));
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void loadDay(currentKey);
    void loadHistory(currentKey);
  }, [currentKey, loadDay, loadHistory]);

  const handleSlotUpdate = (updates: Partial<TimeSlotData> & { key: string }) => {
    if (isReadOnly) return;
    setDataStore((prev) => {
      const currentData = prev[currentKey] ?? generateTimeSlots();
      return {
        ...prev,
        [currentKey]: currentData.map((item) =>
          item.key === updates.key ? { ...item, ...updates } : item,
        ),
      };
    });
  };

  const handleAddSlot = () => {
    setDataStore((prev) => {
      const currentData = prev[currentKey] ?? generateTimeSlots();
      const lastSlot = currentData[currentData.length - 1];
      const timeParts = lastSlot.timeSlot.split(" - ");
      const endTimeStr = timeParts[1];

      const parseTime = (timeStr: string) => {
        const [time, period] = timeStr.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (period === "PM" && h !== 12) h += 12;
        if (period === "AM" && h === 12) h = 0;
        return { hour: h, minute: m };
      };

      const { hour: endHour, minute: endMinute } = parseTime(endTimeStr);
      const newEndTimeStr = formatTime(endHour + 1, endMinute);

      return {
        ...prev,
        [currentKey]: [
          ...currentData,
          {
            key: `extra-${Date.now()}`,
            timeSlot: `${endTimeStr} - ${newEndTimeStr}`,
            title: "",
            task: "",
          },
        ],
      };
    });
  };

  const handleDeleteSlot = (recordKey: string) => {
    setDataStore((prev) => {
      const currentData = prev[currentKey] ?? generateTimeSlots();
      return {
        ...prev,
        [currentKey]: currentData.filter((item) => item.key !== recordKey),
      };
    });
  };

  const changeDate = (days: number) => {
    setCurrentDate((prev) => prev.add(days, "day"));
  };

  const standardSlots = data.slice(0, 9);
  const overtimeSlots = data.slice(9);
  const standardFilled = standardSlots.filter((slot) => slot.task.trim().length > 0).length;
  const overtimeFilled = overtimeSlots.filter((slot) => slot.task.trim().length > 0).length;
  const totalOvertimeSlots = overtimeSlots.length;
  const standardProgressPercent = Math.min(100, Math.round((standardFilled / 8) * 100));
  const overtimeProgressPercent =
    totalOvertimeSlots > 0 ? Math.round((overtimeFilled / totalOvertimeSlots) * 100) : 0;

  return (
    <div className="w-full pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {contextHolder}

      <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 w-full">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Total Logged
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  {(() => {
                    const h = Math.floor(standardFilled);
                    const m = Math.round((standardFilled - h) * 60);
                    if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
                    if (h > 0) return `${h}hrs`;
                    if (m > 0) return `${m}mins`;
                    return "0hrs";
                  })()}
                </span>
                <span className="text-lg text-gray-500 font-medium">/ 8hrs 30mins Target</span>
              </div>
            </div>

            <div className="hidden sm:flex flex-col min-w-[150px] lg:w-48 gap-2">
              <div className="flex justify-between text-xs font-medium text-gray-500">
                <span>Standard</span>
                <span className={standardProgressPercent === 100 ? "text-green-500 font-bold" : ""}>
                  {standardProgressPercent}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${standardProgressPercent === 100 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-green-500"}`}
                  style={{ width: `${standardProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {totalOvertimeSlots > 0 && (
            <>
              <div className="hidden lg:block h-12 w-px bg-gray-200 dark:bg-zinc-700" />
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#D48810] uppercase tracking-wider mb-1">
                    Overtime
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#F5A623]">{overtimeFilled}</span>
                    <span className="text-lg text-gray-500 font-medium">/ {totalOvertimeSlots} hrs</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-4 justify-end">
          <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-full shadow-inner border border-gray-100 dark:border-zinc-800 flex items-center overflow-hidden">
            <button
              onClick={() => changeDate(-1)}
              className="px-4 py-3 hover:bg-white dark:hover:bg-zinc-800 transition-colors border-r border-gray-100 dark:border-zinc-800"
            >
              <LeftOutlined className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
            <div className="flex items-center gap-2 px-4 py-1.5 min-w-[200px] justify-center relative">
              <DatePicker
                value={currentDate}
                onChange={(date) => date && setCurrentDate(date)}
                allowClear={false}
                disabledDate={(current) => current && current > dayjs().endOf("day")}
                format="MMMM D, YYYY"
                variant="borderless"
                className="w-full font-semibold text-gray-700 dark:text-gray-300 cursor-pointer text-center flex-1"
                suffixIcon={<CalendarOutlined className="text-[#F5A623] text-lg" />}
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={currentDate.isSame(dayjs(), "day")}
              className={`px-4 py-3 transition-colors border-l border-gray-100 dark:border-zinc-800 ${currentDate.isSame(dayjs(), "day") ? "opacity-30 cursor-not-allowed" : "hover:bg-white dark:hover:bg-zinc-800"}`}
            >
              <RightOutlined className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading timesheet...</div>
      ) : (
        <TimesheetColumnView days={columnDays} />
      )}
    </div>
  );
}
