"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  SaveOutlined,
  LeftOutlined,
  RightOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { message, DatePicker, Button, Spin } from "antd";
import { apiFetch } from "@/lib/api";
import { getTokenRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getSlotDurationHours, parseTimeSlotRange } from "@/lib/timesheetSlots";

export interface TimeSlotData {
  key: string;
  timeSlot: string;
  title: string;
  task: string;
  taskType?: string;
}

interface TimesheetRecord {
  id: number;
  date: string;
  slots: TimeSlotData[];
  totalHours: number;
}

const DEFAULT_TIME_SLOTS: Array<{ key: string; timeSlot: string; title: string; task: string }> = [
  { key: "slot-08-30-09-30", timeSlot: "08:30 - 09:30", title: "", task: "" },
  { key: "slot-09-30-10-30", timeSlot: "09:30 - 10:30", title: "", task: "" },
  { key: "slot-10-30-11-30", timeSlot: "10:30 - 11:30", title: "", task: "" },
  { key: "slot-11-30-12-30", timeSlot: "11:30 - 12:30", title: "", task: "" },
  { key: "slot-12-30-13-15", timeSlot: "12:30 - 13:15", title: "", task: "" },
  { key: "slot-13-15-14-00", timeSlot: "13:15 - 14:00", title: "", task: "" },
  { key: "slot-14-00-15-00", timeSlot: "14:00 - 15:00", title: "", task: "" },
  { key: "slot-15-00-16-00", timeSlot: "15:00 - 16:00", title: "", task: "" },
  { key: "slot-16-00-17-00", timeSlot: "16:00 - 17:00", title: "", task: "" },
];

function mapLegacySlot(timeSlot: string): string {
  const norm = timeSlot.trim();
  if (norm === "12:30 - 13:30" || norm === "12:30-13:30") return "12:30 - 13:15";
  if (norm === "13:30 - 14:30" || norm === "13:30-14:30") return "13:15 - 14:00";
  if (norm === "14:30 - 15:30" || norm === "14:30-15:30") return "14:00 - 15:00";
  if (norm === "15:30 - 16:30" || norm === "15:30-16:30") return "15:00 - 16:00";
  if (norm === "16:30 - 17:00" || norm === "16:30-17:00") return "16:00 - 17:00";
  return norm;
}

function generateSlotKey(timeSlot: string): string {
  return "slot-" + timeSlot.replace(/[^0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function normalizeDaySlots(
  rawSlots?: Array<{ timeSlot: string; task?: string; title?: string }>,
): TimeSlotData[] {
  const defaultSlots = DEFAULT_TIME_SLOTS.map((s) => ({ ...s, key: generateSlotKey(s.timeSlot) }));
  if (!rawSlots || rawSlots.length === 0) return defaultSlots;

  const taskMap = new Map<string, string>();
  for (const s of rawSlots) {
    if (!s.task?.trim()) continue; // Discards obsolete empty rows
    const targetSlot = mapLegacySlot(s.timeSlot);

    // If multiple legacy slots map to the same target slot, append them
    const existing = taskMap.get(targetSlot);
    if (existing) {
      taskMap.set(targetSlot, existing + " | " + s.task.trim());
    } else {
      taskMap.set(targetSlot, s.task.trim());
    }
  }

  const mergedSlots = defaultSlots.map((ds) => {
    const task = taskMap.get(ds.timeSlot);
    if (task !== undefined) {
      taskMap.delete(ds.timeSlot); // Mark as used
    }
    return {
      ...ds,
      task: task ?? "",
    };
  });

  // Append any remaining legacy slots that aren't in the default list so data is never lost
  for (const [timeSlot, task] of taskMap.entries()) {
    mergedSlots.push({
      key: generateSlotKey(timeSlot),
      timeSlot: timeSlot,
      title: "",
      task: task,
    });
  }

  return mergedSlots;
}

function getDurationBadgeLabel(timeSlot: string): string {
  const range = parseTimeSlotRange(timeSlot);
  if (!range) return "1 hr";
  const mins = range.end - range.start;
  if (mins === 45) return "45 mins";
  if (mins === 30) return "30 mins";
  if (mins === 60) return "1 hr";
  return `${mins} mins`;
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
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [slots, setSlots] = useState<TimeSlotData[]>(DEFAULT_TIME_SLOTS);
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dateKey = selectedDate.format("YYYY-MM-DD");
  const isReadOnly =
    !selectedDate.isSame(dayjs(), "day") &&
    !selectedDate.isSame(dayjs().subtract(1, "day"), "day");

  const fetchTimesheet = useCallback(async () => {
    setLoading(true);
    try {
      const record = await apiFetch<TimesheetRecord | null>(
        `/api/timesheets/day/${dateKey}`,
      );
      const normalized = normalizeDaySlots(record?.slots);
      setSlots(normalized);
      setInitialSnapshot(
        JSON.stringify(
          normalized.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
        ),
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to load timesheet";
      messageApi.error(errMsg);
      const fallback = normalizeDaySlots([]);
      setSlots(fallback);
      setInitialSnapshot(
        JSON.stringify(
          fallback.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [dateKey, messageApi]);

  useEffect(() => {
    void fetchTimesheet();
  }, [fetchTimesheet]);

  const handleTaskChange = (key: string, value: string) => {
    if (isReadOnly) return;
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, task: value } : s)),
    );
  };

  const handleSave = async () => {
    if (isReadOnly) {
      messageApi.warning("You can only edit tasks for today and yesterday.");
      return;
    }

    const currentSnapshot = JSON.stringify(
      slots.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
    );

    if (currentSnapshot === initialSnapshot) {
      messageApi.warning("⚠️ No changes to save");
      return;
    }

    setSaving(true);
    try {
      const payloadSlots = slots
        .filter((s) => s.task.trim().length > 0)
        .map((s) => ({
          key: s.key,
          timeSlot: s.timeSlot,
          title: s.title || "",
          task: s.task.trim(),
        }));

      await apiFetch<TimesheetRecord>("/api/timesheets/save", {
        method: "POST",
        body: JSON.stringify({
          date: dateKey,
          slots: payloadSlots,
        }),
      });

      messageApi.success("Timesheet saved successfully.");
      setInitialSnapshot(currentSnapshot);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to save timesheet";
      messageApi.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const filledHours = useMemo(() => {
    let total = 0;
    for (const slot of slots) {
      if (slot.task.trim().length > 0) {
        total += getSlotDurationHours(slot.timeSlot);
      }
    }
    return parseFloat(total.toFixed(1));
  }, [slots]);

  const targetHours = 8.5;
  const progressPercent = Math.min(100, Math.round((filledHours / targetHours) * 100));
  const isTargetAchieved = filledHours >= targetHours;

  return (
    <div className="max-w-6xl mx-auto pb-24 pt-6 px-4 sm:px-6 font-sans">
      {contextHolder}

      {/* Target Progress Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full md:w-auto">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                DAILY LOGGED HOURS
              </span>
              {!isTargetAchieved ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 border border-amber-200/60 dark:border-amber-800/60">
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Target Achieved
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
                {(() => {
                  const h = Math.floor(filledHours);
                  const m = Math.round((filledHours - h) * 60);
                  if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
                  if (h > 0) return `${h}hrs`;
                  if (m > 0) return `${m}mins`;
                  return "0hrs";
                })()}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-semibold">
                / {(() => {
                  const h = Math.floor(targetHours);
                  const m = Math.round((targetHours - h) * 60);
                  if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
                  if (h > 0) return `${h}hrs`;
                  if (m > 0) return `${m}mins`;
                  return "0hrs";
                })()} Target
              </span>
            </div>
          </div>

          <div className="w-full sm:w-64 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-medium text-gray-500">
              <span>Progress</span>
              <span className={isTargetAchieved ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                {progressPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isTargetAchieved
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                  : "bg-amber-500"
                  }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Daily Timesheet Main Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex flex-col gap-4">
          {/* Title & subtitle */}
          <div>
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-gray-900 dark:text-white text-lg" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedDate.isSame(dayjs(), "day")
                  ? "Today's Timesheet"
                  : selectedDate.format("MMMM D, YYYY")}
              </h1>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Enter task descriptions for each time slot.
            </p>
          </div>

          {/* Mobile: full-width date picker row then full-width save button */}
          {/* Desktop: single row with everything right-aligned */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            {/* Date navigator — full width on mobile */}
            <div className="flex items-center rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 w-full sm:w-auto">
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                className="flex-shrink-0"
                onClick={() => setSelectedDate((prev) => prev.subtract(1, "day"))}
              />
              <div className="flex-1 flex justify-center">
                <DatePicker
                  value={selectedDate}
                  onChange={(d) => d && setSelectedDate(d)}
                  allowClear={false}
                  disabledDate={(current) => current && current > dayjs().endOf("day")}
                  format="MMM D, YYYY"
                  variant="borderless"
                  className="text-center text-sm font-semibold w-36"
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
                />
              </div>
              <Button
                type="text"
                size="small"
                icon={<RightOutlined />}
                className="flex-shrink-0"
                disabled={selectedDate.isSame(dayjs(), "day")}
                onClick={() => setSelectedDate((prev) => prev.add(1, "day"))}
              />
            </div>

            {!selectedDate.isSame(dayjs(), "day") && (
              <Button
                size="middle"
                className="rounded-xl font-medium sm:w-auto"
                onClick={() => setSelectedDate(dayjs())}
              >
                Today
              </Button>
            )}

            {/* Save button — full width on mobile */}
            <Button
              type="primary"
              size="large"
              icon={saving ? <SyncOutlined spin /> : <SaveOutlined />}
              onClick={handleSave}
              disabled={isReadOnly || saving}
              className="bg-amber-500 hover:bg-amber-600 border-none rounded-xl text-white font-semibold shadow-md flex items-center justify-center gap-2 h-12 w-full sm:w-auto sm:h-10 sm:px-6"
            >
              Save Timesheet
            </Button>
          </div>
        </div>

        {/* Table Column Headers */}
        <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-gray-50/50 dark:bg-zinc-800/40 border-b border-gray-100 dark:border-zinc-800 text-xs font-bold text-gray-400 tracking-wider uppercase">
          <div className="col-span-3">TIME SLOT</div>
          <div className="col-span-9">TASK DESCRIPTION</div>
        </div>

        {/* Timesheet Slot Rows */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <Spin size="large" />
            <p className="mt-3 text-sm">Loading timesheet entries...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {slots.map((slot) => {
              const isFilled = slot.task.trim().length > 0;
              const durationLabel = getDurationBadgeLabel(slot.timeSlot);

              return (
                <div
                  key={slot.key}
                  className="flex flex-col md:grid md:grid-cols-12 px-6 py-4 items-start gap-4 transition-colors hover:bg-gray-50/30 dark:hover:bg-zinc-800/20"
                >
                  {/* Left Column: Time slot details & badges */}
                  <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start w-full gap-2 md:pt-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${isFilled
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200 dark:border-amber-800/60"
                          }`}
                      >
                        <ClockCircleOutlined />
                      </div>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-100 tracking-tight">
                        {slot.timeSlot}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 md:pl-9">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                        {durationLabel}
                      </span>

                      {isFilled ? (
                        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                          <CheckOutlined className="text-[10px]" /> Logged
                        </span>
                      ) : (
                        <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 dark:bg-zinc-800/60 text-gray-400 border border-gray-200/40 dark:border-zinc-700/40">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Task input text field */}
                  <div className="col-span-1 md:col-span-9 w-full">
                    <textarea
                      rows={2}
                      value={slot.task}
                      onChange={(e) => handleTaskChange(slot.key, e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Enter task description..."
                      className={`w-full rounded-xl p-2.5 text-xs transition-all duration-200 resize-none outline-none ${isFilled
                        ? "border border-emerald-300 dark:border-emerald-800/80 text-gray-900 dark:text-zinc-100 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                        } ${isReadOnly ? "opacity-75 cursor-not-allowed" : ""}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
