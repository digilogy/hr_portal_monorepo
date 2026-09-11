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
import { message, DatePicker, Button, Spin, Select, Modal } from "antd";
import { apiFetch } from "@/lib/api";
import { getTokenRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { getSlotDurationHours, parseTimeSlotRange } from "@/lib/timesheetSlots";
import { getHolidayZoneForCity } from "@/lib/holidayMapping";

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  zones: string[];
  isOptional: boolean;
}

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

function isNonWorkingDay(date: Dayjs, profile: any): boolean {
  if (!profile) return false;

  const dayOfWeek = date.day(); // 0 is Sunday
  if (profile.weeklyOff) {
    const offDaysMap: Record<string, number> = {
      sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
      wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
    };
    const offDays = profile.weeklyOff.split(",").map((d: string) => d.trim().toLowerCase());
    for (const off of offDays) {
      if (offDaysMap[off] === dayOfWeek) return true;

      const nthMatch = off.match(/^(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(.+)$/);
      if (nthMatch) {
        const nthMap: Record<string, number> = {
          first: 1, '1st': 1,
          second: 2, '2nd': 2,
          third: 3, '3rd': 3,
          fourth: 4, '4th': 4,
          fifth: 5, '5th': 5
        };
        const n = nthMap[nthMatch[1]];
        const targetDay = offDaysMap[nthMatch[2]];
        if (n && targetDay !== undefined) {
          const dateNum = date.date();
          const currentNth = Math.ceil(dateNum / 7);
          if (dayOfWeek === targetDay && currentNth === n) {
            return true;
          }
        }
      }
    }
  }

  // Check holidays
  if (profile.upcomingHolidays && profile.upcomingHolidays.length > 0) {
    const dateStr = date.format("YYYY-MM-DD");
    const holiday = profile.upcomingHolidays.find((h: any) => {
      if (h.isOptional) return false;
      const formatYMD = (d: string) => dayjs(d).format("YYYY-MM-DD");
      const start = formatYMD(h.startDate);
      const end = formatYMD(h.endDate);
      return dateStr >= start && dateStr <= end;
    });
    if (holiday) return true;
  }

  return false;
}

function getLastWorkingDay(startFromDate: Dayjs, profile: any): Dayjs {
  let date = startFromDate.subtract(1, 'day');
  // safeguard against infinite loops
  let iterations = 0;
  while (isNonWorkingDay(date, profile) && iterations < 30) {
    date = date.subtract(1, 'day');
    iterations++;
  }
  return date;
}

function getEffectiveTiming(date: Dayjs, profile: any, defaultTiming: string): string {
  if (!profile) return defaultTiming;

  const dayOfWeek = date.day();
  if (profile.halfDay) {
    const match = profile.halfDay.match(/^([a-zA-Z]+)\s*\((.*?)\s*-\s*(.*?)\)/);
    if (match) {
      const dayStr = match[1].toLowerCase();
      const start = match[2].trim();
      const end = match[3].trim();
      const daysMap: Record<string, number> = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
      };
      if (daysMap[dayStr] === dayOfWeek) {
        return `${start} - ${end}`;
      }
    }
  }
  return defaultTiming;
}

function normalizeDaySlots(
  rawSlots: Array<{ timeSlot: string; task?: string; title?: string }> | undefined,
  dynamicDefaultSlots: Array<{ key: string; timeSlot: string; title: string; task: string }>
): TimeSlotData[] {
  const safeSlots = dynamicDefaultSlots || DEFAULT_TIME_SLOTS || [];
  const defaultSlots = safeSlots.map((s) => ({ ...s, key: generateSlotKey(s.timeSlot) }));
  if (!rawSlots || rawSlots.length === 0) return defaultSlots;

  const defaultSlotSet = new Set(defaultSlots.map(s => s.timeSlot));

  const taskMap = new Map<string, string>();
  for (const s of rawSlots) {
    if (!s.task?.trim()) continue; // Discards obsolete empty rows

    let targetSlot = s.timeSlot.trim();
    // Only map legacy slots if the exact original slot doesn't exist in our default list
    if (!defaultSlotSet.has(targetSlot)) {
      const mapped = mapLegacySlot(targetSlot);
      if (defaultSlotSet.has(mapped)) {
        targetSlot = mapped;
      }
    }

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

  // Append any remaining raw slots that weren't matched to avoid data loss
  for (const [timeSlot, task] of taskMap.entries()) {
    mergedSlots.push({
      key: generateSlotKey(timeSlot) + "-extra",
      timeSlot,
      title: "",
      task
    });
  }

  // Sort slots chronologically to ensure extra slots appear in correct order
  mergedSlots.sort((a, b) => {
    const timeA = a.timeSlot.split('-')[0].trim();
    const timeB = b.timeSlot.split('-')[0].trim();
    const [hA, mA] = timeA.split(':').map(Number);
    const [hB, mB] = timeB.split(':').map(Number);
    if (hA !== hB) return (hA || 0) - (hB || 0);
    return (mA || 0) - (mB || 0);
  });

  return mergedSlots;
}

function generateDynamicSlots(timing: string): Array<{ key: string; timeSlot: string; title: string; task: string }> {
  if (!timing) return DEFAULT_TIME_SLOTS;
  const parts = timing.split("-").map(p => p.trim());
  if (parts.length !== 2) return DEFAULT_TIME_SLOTS;

  const parseTime = (t: string) => {
    const [h, m] = t.split(":");
    return parseInt(h) + (parseInt(m) || 0) / 60;
  };

  const start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (Number.isNaN(start) || Number.isNaN(end)) return DEFAULT_TIME_SLOTS;
  if (end <= start) end += 24;

  const formatTime = (h: number) => {
    const hr = Math.floor(h) % 24;
    const min = Math.round((h - Math.floor(h)) * 60);
    return `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  const slots = [];
  for (let current = start; current < end; current += 1) {
    const slotEnd = Math.min(current + 1, end);
    const timeSlot = `${formatTime(current)} - ${formatTime(slotEnd)}`;
    slots.push({
      key: generateSlotKey(timeSlot),
      timeSlot,
      title: "",
      task: ""
    });
  }

  return slots.length > 0 ? slots : DEFAULT_TIME_SLOTS;
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

  const [shiftOptions, setShiftOptions] = useState<string[]>([]);
  const [selectedTiming, setSelectedTiming] = useState<string>("");
  const [profile, setProfile] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [savingTiming, setSavingTiming] = useState(false);
  const [hasEditedSinceLastManualSave, setHasEditedSinceLastManualSave] = useState(false);
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await apiFetch<Holiday[]>("/api/admin/holidays");
        setAllHolidays(data || []);
      } catch (err) {
        // ignore
      }
    };
    fetchHolidays();
  }, []);

  const currentHoliday = useMemo(() => {
    if (!profile?.upcomingHolidays?.length) return null;
    const dateStr = selectedDate.format("YYYY-MM-DD");

    return profile.upcomingHolidays.find((h: any) => {
      const formatYMD = (d: string) => dayjs(d).format("YYYY-MM-DD");
      const start = formatYMD(h.startDate);
      const end = formatYMD(h.endDate);
      return dateStr >= start && dateStr <= end;
    });
  }, [selectedDate, profile]);

  const lastWorkingDate = useMemo(() => {
    return getLastWorkingDay(dayjs(), profile);
  }, [profile]);

  const dateKey = selectedDate.format("YYYY-MM-DD");
  const isReadOnly =
    (!!currentHoliday && !currentHoliday.isOptional) ||
    (!selectedDate.isSame(dayjs(), "day") &&
      !selectedDate.isSame(lastWorkingDate, "day"));

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await apiFetch<{ profile: any }>("/api/profile/me");
        const timings = data.profile?.allowedTimings;
        const pref = data.profile?.preferredTiming;
        if (timings) {
          const opts = timings.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
          setShiftOptions(opts);
          if (opts.length > 1) {
            if (pref && opts.includes(pref)) {
              setSelectedTiming(pref);
            } else {
              setShowShiftModal(true);
              setSelectedTiming(opts[0]);
            }
          } else if (opts.length === 1) {
            setSelectedTiming(opts[0]);
          }
        }
        setProfile(data.profile);
      } catch (err) {
        // ignore
      } finally {
        setProfileLoaded(true);
      }
    };
    void loadProfile();
  }, []);

  const handleConfirmShift = async () => {
    try {
      await apiFetch("/api/profile/me/preferred-timing", {
        method: "PUT",
        body: JSON.stringify({ preferredTiming: selectedTiming }),
      });
      setShowShiftModal(false);
    } catch (err) {
      messageApi.error("Failed to save shift preference");
    }
  };

  const fetchTimesheet = useCallback(async () => {
    if (!profileLoaded) return;
    setLoading(true);
    try {
      const record = await apiFetch<TimesheetRecord | null>(
        `/api/timesheets/day/${dateKey}`,
      );

      const effectiveTiming = getEffectiveTiming(selectedDate, profile, selectedTiming);
      const defaultSlots = generateDynamicSlots(effectiveTiming);
      const normalized = normalizeDaySlots(record?.slots, defaultSlots);

      // If it's a holiday (and not optional) and no slots are filled, pre-fill with holiday message
      if (currentHoliday && !currentHoliday.isOptional && (!record || record.slots.length === 0)) {
        normalized.forEach(s => s.task = `Holiday: ${currentHoliday.name}`);
      }

      setSlots(normalized);
      setInitialSnapshot(
        JSON.stringify(
          normalized.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
        ),
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to load timesheet";
      messageApi.error(errMsg);
      const effectiveTiming = getEffectiveTiming(selectedDate, profile, selectedTiming);
      const defaultSlots = generateDynamicSlots(effectiveTiming);
      const fallback = normalizeDaySlots([], defaultSlots);

      if (currentHoliday && !currentHoliday.isOptional) {
        fallback.forEach(s => s.task = `Holiday: ${currentHoliday.name}`);
      }

      setSlots(fallback);
      setInitialSnapshot(
        JSON.stringify(
          fallback.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [dateKey, messageApi, profileLoaded, selectedTiming, currentHoliday, profile, selectedDate]);

  useEffect(() => {
    void fetchTimesheet();
  }, [fetchTimesheet]);

  const handleTaskChange = (key: string, value: string) => {
    if (isReadOnly) return;
    setHasEditedSinceLastManualSave(true);
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, task: value } : s)),
    );
  };

  const performSave = useCallback(async (slotsToSave: TimeSlotData[], isAutoSave: boolean = false) => {
    if (isReadOnly) {
      if (!isAutoSave) messageApi.warning("You can only edit tasks for today and yesterday.");
      return;
    }

    const currentSnapshot = JSON.stringify(
      slotsToSave.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
    );

    if (currentSnapshot === initialSnapshot) {
      if (!isAutoSave) {
        if (hasEditedSinceLastManualSave) {
          messageApi.success("Timesheet saved successfully.");
          setHasEditedSinceLastManualSave(false);
        } else {
          messageApi.warning("⚠️ No changes to save");
        }
      }
      return;
    }

    setSaving(true);
    try {
      const payloadSlots = slotsToSave
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

      if (!isAutoSave) {
        messageApi.success("Timesheet saved successfully.");
        setHasEditedSinceLastManualSave(false);
      } else {
        messageApi.success("Timesheet auto-saved.");
      }
      setInitialSnapshot(currentSnapshot);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to save timesheet";
      if (!isAutoSave) messageApi.error(errMsg);
    } finally {
      setSaving(false);
    }
  }, [isReadOnly, messageApi, initialSnapshot, hasEditedSinceLastManualSave, dateKey]);

  const handleSave = useCallback(() => performSave(slots, false), [performSave, slots]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (loading || isReadOnly || saving) return;

    const currentSnapshot = JSON.stringify(
      slots.map((s) => ({ timeSlot: s.timeSlot, task: s.task.trim() })),
    );

    if (currentSnapshot === initialSnapshot) return;

    const timer = setTimeout(() => {
      void performSave(slots, true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [slots, loading, isReadOnly, saving, initialSnapshot, dateKey, performSave]);

  const filledHours = useMemo(() => {
    let total = 0;
    for (const slot of slots) {
      if (slot.task.trim().length > 0) {
        total += getSlotDurationHours(slot.timeSlot);
      }
    }
    return Math.round(total * 60) / 60;
  }, [slots]);

  const targetHours = useMemo(() => {
    if (!profile) return 8.5;

    const timingToParse = getEffectiveTiming(selectedDate, profile, selectedTiming || profile.allowedTimings?.split(',')[0]);
    if (timingToParse) {
      const [start, end] = timingToParse.split("-").map((s: string) => s.trim());
      if (start && end) {
        const parseTime = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return (h || 0) + (m || 0) / 60;
        };
        const h1 = parseTime(start);
        const h2 = parseTime(end);
        if (h2 > h1) return h2 - h1;
      }
    }

    return 8.5;
  }, [profile, selectedDate, selectedTiming]);

  const progressPercent = Math.min(100, Math.round((filledHours / targetHours) * 100));
  const isTargetAchieved = filledHours >= targetHours;

  const progressStyle = useMemo(() => {
    if (progressPercent < 33) {
      return { stroke: "#ef4444", textClass: "text-red-500", bgClass: "bg-red-500", bgGradient: "bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.35)]" };
    }
    if (progressPercent < 66) {
      return { stroke: "#f97316", textClass: "text-orange-500", bgClass: "bg-orange-500", bgGradient: "bg-gradient-to-r from-orange-500 to-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.35)]" };
    }
    if (progressPercent < 100) {
      return { stroke: "#f59e0b", textClass: "text-amber-500", bgClass: "bg-amber-400", bgGradient: "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.35)]" };
    }
    return { stroke: "#10b981", textClass: "text-emerald-500", bgClass: "bg-emerald-500", bgGradient: "bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(34,197,94,0.35)]" };
  }, [progressPercent]);

  return (
    <div className="max-w-6xl mx-auto pb-24 pt-6 px-4 sm:px-6 font-sans">
      {contextHolder}

      <Modal
        title={<span className="font-bold">Select Your Shift Timing</span>}
        open={showShiftModal}
        closable={false}
        mask={{ closable: false }}
        footer={[
          <Button key="submit" type="primary" onClick={handleConfirmShift} className="bg-amber-500 hover:bg-amber-600 rounded-xl font-semibold border-none">
            Confirm Selection
          </Button>
        ]}
      >
        <p className="mb-4 text-gray-600 mt-2">
          Your assigned shift has multiple timing options. Please select your preferred daily schedule. You can always change this later in your Profile settings.
        </p>
        <Select
          value={selectedTiming}
          onChange={setSelectedTiming}
          className="w-full h-10"
          options={shiftOptions.map(opt => ({ label: opt, value: opt }))}
        />
      </Modal>

      <div style={{ display: 'none' }} id="debug-info">
        {JSON.stringify({ shiftOptions, selectedTiming, profileLoaded })}
      </div>

      {/* Target Progress Header Card */}
      <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-800 p-6 mb-8">
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
        <div className="flex items-baseline gap-1.5 mb-3">
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
        <div className="h-1.5 w-full max-w-xs bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressStyle.bgGradient}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {currentHoliday && !currentHoliday.isOptional && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex items-center justify-center">
          <span className="font-semibold text-lg">🎉 Holiday: {currentHoliday.name}</span>
        </div>
      )}

      {/* Daily Timesheet Main Card */}
      <div className="bg-white dark:bg-zinc-900 shadow-sm">
        {/* Sticky Container Wrapper */}
        <div className="sticky top-[63px] z-10">
          {/* Scroll Shield to cover rows between site header (64px) and this sticky header (88px) */}
          {/* <div className="absolute top-[-24px] left-0 right-0 h-6 bg-white dark:bg-zinc-900" aria-hidden="true" /> */}

          {/* Actual Header */}
          <div className="bg-white dark:bg-zinc-900">
            {/* Header Bar */}
            <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Title & subtitle */}
              <div>
                <div className="flex items-center gap-3">
                  <CalendarOutlined className="text-gray-900 dark:text-white text-lg" />
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedDate.isSame(dayjs(), "day")
                      ? "Today's Timesheet"
                      : selectedDate.format("MMMM D, YYYY")}
                  </h1>
                  {/* Circular Donut Ring — compact, beside the title */}
                  <div className="relative flex-shrink-0 w-10 h-10">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={isTargetAchieved ? "#d1fae5" : "#f1f5f9"} strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke={progressStyle.stroke}
                        strokeWidth="3.5"
                        strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 0.7s ease, stroke 0.7s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-[9px] font-bold leading-none ${progressStyle.textClass}`}>
                        {progressPercent}%
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Enter task descriptions for each time slot.
                </p>
              </div>

              {/* Mobile & Desktop: single row, wrapped or scrolling if necessary */}
              <div className="flex flex-row items-center justify-start sm:justify-end gap-1 w-full sm:w-auto">
                <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl h-8">
                  <button
                    className={`px-2 h-full text-xs font-medium cursor-pointer rounded-lg transition-all ${selectedDate.isSame(lastWorkingDate, 'day') ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 border border-amber-200/60 dark:border-amber-800/60 shadow-sm' : 'border border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 hover:bg-white hover:shadow-sm dark:hover:text-gray-200 dark:hover:bg-zinc-700'}`}
                    onClick={() => setSelectedDate(lastWorkingDate)}
                  >
                    Yesterday
                  </button>
                  <button
                    className={`px-2 h-full text-xs font-medium cursor-pointer rounded-lg transition-all ${selectedDate.isSame(dayjs(), 'day') ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500 border border-amber-200/60 dark:border-amber-800/60 shadow-sm' : 'border border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 hover:bg-white hover:shadow-sm dark:hover:text-gray-200 dark:hover:bg-zinc-700'}`}
                    onClick={() => setSelectedDate(dayjs())}
                  >
                    Today
                  </button>
                </div>

                {/* Date navigator — full width on mobile */}
                <div className="flex items-center rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 w-full sm:w-auto h-8">
                  <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    className="flex-shrink-0 h-full px-2 rounded-l-xl"
                    onClick={() => setSelectedDate((prev) => prev.subtract(1, "day"))}
                  />
                  <div className="flex-1 flex justify-center">
                    <DatePicker
                      value={selectedDate}
                      onChange={(d) => d && setSelectedDate(d)}
                      allowClear={false}
                      disabledDate={(current) => {
                        if (current && current > dayjs().endOf("day")) return true;
                        if (current && isNonWorkingDay(current, profile)) return true;
                        return false;
                      }}
                      format="MMM D, YYYY"
                      variant="borderless"
                      className="w-[100px] [&_input]:!text-[11px] [&_input]:!font-semibold [&_input]:!text-center [&_input]:!px-0"
                      suffixIcon={null}
                    />
                  </div>
                  <Button
                    type="text"
                    size="small"
                    icon={<RightOutlined />}
                    className="flex-shrink-0 h-full px-2 rounded-r-xl"
                    disabled={selectedDate.isSame(dayjs(), "day")}
                    onClick={() => setSelectedDate((prev) => prev.add(1, "day"))}
                  />
                </div>

              </div>
            </div>

            {/* Table Column Headers */}
            <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-gray-50/50 dark:bg-zinc-800/40 text-xs font-bold text-gray-400 tracking-wider uppercase border-b-1 border-gray-300 dark:border-zinc-700">
              <div className="col-span-3">TIME SLOT</div>
              <div className="col-span-9">TASK DESCRIPTION</div>
            </div>
          </div>
        </div>

        {/* Timesheet Slot Rows */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <Spin size="large" />
            <p className="mt-3 text-sm">Loading timesheet entries...</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {slots.map((slot) => {
              const isFilled = slot.task.trim().length > 0;
              const durationLabel = getDurationBadgeLabel(slot.timeSlot);

              return (
                <div
                  key={slot.key}
                  className={`flex flex-col md:grid md:grid-cols-12 px-6 py-4 items-start gap-4 transition-colors border-l-4 ${isFilled
                    ? "border-l-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                    : "border-l-transparent hover:bg-gray-50/40 dark:hover:bg-zinc-800/20"
                    }`}
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
                      placeholder={`What did you work on during ${slot.timeSlot}?`}
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

        {/* Bottom Save Button */}
        <div className="p-6 flex flex-col sm:flex-row items-center justify-end gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
            {slots.filter(s => s.task.trim().length > 0).length} of {slots.length} slots filled
          </span>
          <Button
            type="primary"
            size="large"
            icon={saving ? <SyncOutlined spin /> : <SaveOutlined />}
            onClick={handleSave}
            disabled={isReadOnly || saving}
            className="bg-amber-500 hover:bg-amber-600 border-none rounded-xl text-white text-sm font-semibold shadow-md flex items-center justify-center gap-2 px-8"
          >
            Save Timesheet
          </Button>
        </div>
      </div>
    </div>
  );
}
