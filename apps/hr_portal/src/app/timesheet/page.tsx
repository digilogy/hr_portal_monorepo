"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { TimesheetGrid, TimeSlotData } from "@/components/ui/TimesheetGrid";
import {
  TimesheetColumnView,
  TimesheetDayView,
} from "@/components/ui/TimesheetColumnView";
import { CalendarOutlined, AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { message, DatePicker, Segmented } from "antd";
import { apiFetch } from "@/lib/api";
import { getTokenRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  findSlotTimeConflict,
  getLatestSlotEndMinutes,
  getSlotDurationHours,
  minutesTo24h,
  normalizeTimeSlotRange,
} from "@/lib/timesheetSlots";

const { RangePicker } = DatePicker;

const CONFIG = {
  START_HOUR: 8,
  START_MINUTE: 30,
};

const generateTimeSlots = (): TimeSlotData[] => [];

interface TimesheetRecord {
  id: number;
  date: string;
  slots: TimeSlotData[];
  totalHours: number;
}

function calculateDurationHours(timeStr: string) {
  return getSlotDurationHours(timeStr);
}

function calculateTotalFilledHours(slots: TimeSlotData[]) {
  return parseFloat(
    slots
      .filter((slot) => slot.timeSlot && slot.timeSlot.trim().length > 0)
      .reduce((sum, slot) => sum + calculateDurationHours(slot.timeSlot), 0)
      .toFixed(1),
  );
}

export default function TimesheetPage() {
  const router = useRouter();

  useEffect(() => {
    const role = getTokenRole();
    if (role === "admin") {
      router.replace("/dashboard");
    }
  }, [router]);

  const [messageApi, contextHolder] = message.useMessage();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("week"),
    dayjs(),
  ]);
  const [viewMode, setViewMode] = useState<"grid" | "column">("grid");
  const [gridDate, setGridDate] = useState(dayjs());
  const [dataStore, setDataStore] = useState<Record<string, TimeSlotData[]>>({});
  const [rangeEntries, setRangeEntries] = useState<TimesheetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const activeDate = useMemo(() => {
    if (viewMode === "grid") {
      return gridDate;
    }

    const today = dayjs();
    const [start, end] = dateRange;
    if (
      (today.isAfter(start, "day") || today.isSame(start, "day")) &&
      (today.isBefore(end, "day") || today.isSame(end, "day"))
    ) {
      return today;
    }
    return end;
  }, [dateRange, viewMode, gridDate]);

  const activeKey = activeDate.format("YYYY-MM-DD");
  const data = dataStore[activeKey] ?? generateTimeSlots();
  const isReadOnly =
    !activeDate.isSame(dayjs(), "day") &&
    !activeDate.isSame(dayjs().subtract(1, "day"), "day");

  const loadRange = useCallback(async () => {
    const from = dateRange[0].format("YYYY-MM-DD");
    const to = dateRange[1].format("YYYY-MM-DD");

    setLoading(true);
    try {
      const entries = await apiFetch<TimesheetRecord[]>(
        `/api/timesheets/history?fromDate=${from}&toDate=${to}`,
      );
      const normalizedEntries = entries.map((entry) => ({
        ...entry,
        slots: entry.slots.map((slot) => ({
          ...slot,
          timeSlot: normalizeTimeSlotRange(slot.timeSlot),
        })),
      }));
      setRangeEntries(normalizedEntries);

      const entryMap = new Map(
        normalizedEntries.map((entry) => [dayjs(entry.date).format("YYYY-MM-DD"), entry]),
      );
      const activeEntry = entryMap.get(activeKey);

      if (activeEntry?.slots?.length) {
        setDataStore((prev) => ({
          ...prev,
          [activeKey]: activeEntry.slots.map((slot) => ({
            ...slot,
            timeSlot: normalizeTimeSlotRange(slot.timeSlot),
          })),
        }));
      } else {
        const dayEntry = await apiFetch<TimesheetRecord | null>(
          `/api/timesheets/day/${activeKey}`,
        );
        setDataStore((prev) => ({
          ...prev,
          [activeKey]: dayEntry?.slots?.length
            ? dayEntry.slots.map((slot) => ({
                ...slot,
                timeSlot: normalizeTimeSlotRange(slot.timeSlot),
              }))
            : generateTimeSlots(),
        }));
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to load timesheet";
      messageApi.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [activeKey, dateRange, messageApi]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const columnDays = useMemo((): TimesheetDayView[] => {
    const [start, end] = dateRange;
    const entryMap = new Map(
      rangeEntries.map((entry) => [dayjs(entry.date).format("YYYY-MM-DD"), entry]),
    );
    const days: TimesheetDayView[] = [];
    let cursor = start.startOf("day");
    const last = end.startOf("day");

    while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
      const key = cursor.format("YYYY-MM-DD");
      const entry = entryMap.get(key);
      const isToday = cursor.isSame(dayjs(), "day");
      const slots =
        dataStore[key] !== undefined
          ? dataStore[key]
          : entry?.slots ?? [];

      days.push({
        dateKey: key,
        dateStr: cursor.format("MMM D, YYYY"),
        totalHours:
          dataStore[key] !== undefined
            ? calculateTotalFilledHours(dataStore[key])
            : entry?.totalHours ?? 0,
        slots,
        isToday,
      });
      cursor = cursor.add(1, "day");
    }

    return days.sort(
      (a, b) => dayjs(b.dateKey).valueOf() - dayjs(a.dateKey).valueOf(),
    );
  }, [activeKey, dataStore, dateRange, rangeEntries]);

  const handleSlotUpdate = (updates: Partial<TimeSlotData> & { key: string }) => {
    if (isReadOnly) return;
    setDataStore((prev) => {
      const currentData = prev[activeKey] ?? generateTimeSlots();
      return {
        ...prev,
        [activeKey]: currentData.map((item) =>
          item.key === updates.key ? { ...item, ...updates } : item,
        ),
      };
    });
  };

  const handleTimeChange = (newTime: string, recordKey: string) => {
    if (isReadOnly) return;
    setDataStore((prev) => {
      const currentData = prev[activeKey] ?? generateTimeSlots();
      return {
        ...prev,
        [activeKey]: currentData.map((item) =>
          item.key === recordKey ? { ...item, timeSlot: newTime } : item,
        ),
      };
    });
  };

  const handleBulkTaskChange = (updates: Record<string, string>) => {
    if (isReadOnly) return;
    setDataStore((prev) => {
      const currentData = prev[activeKey] ?? generateTimeSlots();
      return {
        ...prev,
        [activeKey]: currentData.map((item) =>
          updates[item.key] !== undefined ? { ...item, task: updates[item.key] } : item,
        ),
      };
    });
  };

  const getNextSlotDraft = (dateKey: string = activeKey): TimeSlotData => {
    const currentData = dataStore[dateKey] ?? generateTimeSlots();

    let startMinutes = CONFIG.START_HOUR * 60 + CONFIG.START_MINUTE;
    const latestEnd = getLatestSlotEndMinutes(currentData);
    if (latestEnd !== null) startMinutes = latestEnd;

    let candidate = `${minutesTo24h(startMinutes)} - ${minutesTo24h(startMinutes + 60)}`;
    let attempts = 0;
    while (findSlotTimeConflict(currentData, candidate) && attempts < 24) {
      startMinutes += 60;
      candidate = `${minutesTo24h(startMinutes)} - ${minutesTo24h(startMinutes + 60)}`;
      attempts += 1;
    }

    return {
      key: `extra-${Date.now()}`,
      timeSlot: candidate,
      title: "",
      task: "",
    };
  };

  const persistTimesheet = useCallback(
    async (
      dateKey: string,
      slots: TimeSlotData[],
      feedbackMessage = "Task saved.",
      feedbackType: "success" | "warning" = "success",
    ) => {
      setDataStore((prev) => ({
        ...prev,
        [dateKey]: slots,
      }));

      try {
        await apiFetch<TimesheetRecord>("/api/timesheets/save", {
          method: "POST",
          body: JSON.stringify({
            date: dateKey,
            slots,
          }),
        });
        messageApi[feedbackType](feedbackMessage);
        await loadRange();
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Failed to save task";
        messageApi.error(errMsg);
        throw error;
      }
    },
    [loadRange, messageApi],
  );

  const handleDeleteSlot = (recordKey: string) => {
    if (isReadOnly) return;

    const currentData = dataStore[activeKey] ?? generateTimeSlots();
    const updatedSlots = currentData.filter((item) => item.key !== recordKey);
    void persistTimesheet(activeKey, updatedSlots, "Task deleted.", "warning");
  };

  const handleRangeChange = (
    dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
  ) => {
    if (dates?.[0] && dates?.[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  let totalFilledHours = 0;
  data.forEach((slot) => {
    if (slot.timeSlot && slot.timeSlot.trim().length > 0) {
      totalFilledHours += calculateDurationHours(slot.timeSlot);
    }
  });

  const standardTargetHours = 8.5;
  const standardFilled = Math.min(totalFilledHours, standardTargetHours);
  const overtimeFilled = Math.max(0, totalFilledHours - standardTargetHours);

  const standardProgressPercent = Math.min(
    100,
    Math.round((standardFilled / standardTargetHours) * 100),
  );

  const showOvertime = overtimeFilled > 0;

  return (
    <div className="max-w-7xl mx-auto pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      {contextHolder}

      <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 w-full">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Total Logged
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {Number(standardFilled.toFixed(1))}
                </span>
                <span className="text-lg text-gray-500 font-medium">/ 8.5 hrs Target</span>
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

          {showOvertime && (
            <>
              <div className="hidden lg:block h-12 w-px bg-gray-200 dark:bg-zinc-700" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#D48810] uppercase tracking-wider mb-1">
                  Overtime
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#F5A623]">
                    {Number(overtimeFilled.toFixed(1))}
                  </span>
                  <span className="text-lg text-gray-500 font-medium">hrs</span>
                </div>
              </div>
            </>
          )}
        </div>

        {viewMode === "column" && (
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-4 justify-end">
            <RangePicker
              value={dateRange}
              onChange={handleRangeChange}
              allowClear={false}
              disabledDate={(current) =>
                !!current && current > dayjs().endOf("day")
              }
              format="MMM D, YYYY"
              className="rounded-full shadow-inner border border-gray-100 dark:border-zinc-800 h-[40px] px-2"
              suffixIcon={<CalendarOutlined className="text-[#F5A623] text-lg" />}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end mb-4">
        <Segmented
          options={[
            { value: "grid", icon: <AppstoreOutlined /> },
            { value: "column", icon: <BarsOutlined /> },
          ]}
          value={viewMode}
          onChange={(val) => setViewMode(val as "grid" | "column")}
          size="large"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading timesheet...</div>
      ) : viewMode === "grid" ? (
        <TimesheetGrid
          data={data}
          onSlotUpdate={handleSlotUpdate}
          onTimeChange={handleTimeChange}
          onBulkTaskChange={handleBulkTaskChange}
          getNextSlotDraft={getNextSlotDraft}
          onDeleteSlot={handleDeleteSlot}
          onSaveTask={isReadOnly ? undefined : persistTimesheet}
          readOnly={isReadOnly}
          onReadOnlyClick={() =>
            messageApi.warning("You can only edit tasks for today and yesterday.")
          }
          selectedDate={activeDate}
          onDateChange={setGridDate}
        />
      ) : (
        <TimesheetColumnView
          days={columnDays}
          onSaveTask={persistTimesheet}
          getNextSlotDraft={getNextSlotDraft}
          onReadOnlyClick={() =>
            messageApi.warning("You can only edit tasks for today and yesterday.")
          }
        />
      )}
    </div>
  );
}
