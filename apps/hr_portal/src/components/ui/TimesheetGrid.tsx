/**
 * @file TimesheetGrid.tsx
 * @description Card-based grid view for today's timesheet entries.
 *              Opens a TaskEntryModal for adding/editing slots.
 */

"use client";

import React, { useState, useEffect } from "react";
import { TimeSlotCard } from "./TimeSlotCard";
import { TimeSpinnerInput } from "./TimeSpinnerInput";
import { CloseOutlined, AppstoreOutlined, CalendarOutlined } from "@ant-design/icons";
import { DatePicker, Modal } from "antd";
import dayjs from "dayjs";

import { findSlotTimeConflict, normalizeTimeSlotRange } from "@/lib/timesheetSlots";
import {
  TaskType,
  TASK_TYPE_OPTIONS,
  getTaskTypeTitle,
  isCustomTaskType,
  isOptionalDescriptionTaskType,
} from "@/lib/taskTypes";

export type { TaskType };
export { TASK_TYPE_OPTIONS };

export interface TimeSlotData {
  key: string;
  timeSlot: string;
  /** Short title for the slot (required before save) */
  title: string;
  /** Detailed description of the task (required before save) */
  task: string;
  /** Category of the task */
  taskType?: TaskType;
  isLunch?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


// ─── Props ────────────────────────────────────────────────────────────────────

interface TimesheetGridProps {
  data: TimeSlotData[];
  onSlotUpdate: (updates: Partial<TimeSlotData> & { key: string }) => void;
  onTimeChange?: (newTime: string, key: string) => void;
  onBulkTaskChange?: (updates: Record<string, string>) => void;
  getNextSlotDraft?: (dateKey?: string) => TimeSlotData;
  onDeleteSlot?: (key: string) => void;
  onSaveTask?: (dateKey: string, slots: TimeSlotData[]) => Promise<void>;
  readOnly?: boolean;
  onReadOnlyClick?: () => void;
  selectedDate?: dayjs.Dayjs;
  onDateChange?: (date: dayjs.Dayjs) => void;
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const INPUT_BASE =
  "w-full px-4 py-2.5 border rounded-xl bg-gray-50 dark:bg-zinc-900/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40 focus:border-[#F5A623] transition-all text-sm";

const LABEL_BASE = "text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1";

// ─── Component ────────────────────────────────────────────────────────────────

export const TimesheetGrid: React.FC<TimesheetGridProps> = ({
  data,
  onSlotUpdate,
  onTimeChange,
  onBulkTaskChange,
  getNextSlotDraft,
  onDeleteSlot,
  onSaveTask,
  readOnly = false,
  onReadOnlyClick,
  selectedDate,
  onDateChange,
}) => {
  const [modal, contextHolder] = Modal.useModal();
  const [activeSlot, setActiveSlot] = useState<TimeSlotData | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTask, setDraftTask] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftType, setDraftType] = useState<TaskType>("Custom");
  const [formErrors, setFormErrors] = useState<{ title?: string; task?: string; time?: string }>({});

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, string>>({});
  const [savingTask, setSavingTask] = useState(false);

  const isDraftSlot = (slot: TimeSlotData) =>
    !data.some((item) => item.key === slot.key);

  const handleOpenModal = (slot: TimeSlotData) => {
    if (readOnly) { onReadOnlyClick?.(); return; }
    setActiveSlot(slot);
    setDraftTitle(slot.title && isCustomTaskType(slot.taskType) ? slot.title : "");
    setDraftTask(slot.task || "");
    setDraftTime(slot.timeSlot);
    setDraftType(slot.taskType ?? "Custom");
    setFormErrors({});
  };

  const handleCloseModal = () => {
    setActiveSlot(null);
    setDraftTitle("");
    setDraftTask("");
    setDraftTime("");
    setFormErrors({});
  };

  const saveDateKey = selectedDate?.format("YYYY-MM-DD") ?? dayjs().format("YYYY-MM-DD");

  const handleSaveModal = async () => {
    const errors: { title?: string; task?: string; time?: string } = {};
    if (isCustomTaskType(draftType) && !draftTitle.trim()) errors.title = "Title is required for Custom type.";
    if (!isOptionalDescriptionTaskType(draftType)) {
      const wordCount = draftTask.trim().split(/\s+/).filter(Boolean).length;
      if (!draftTask.trim()) errors.task = "Description is required.";
      else if (wordCount < 10) errors.task = `Description must be at least 10 words (${wordCount}/10).`;
    }

    if (activeSlot) {
      const slotIndex = data.findIndex((slot) => slot.key === activeSlot.key);
      const otherSlots =
        slotIndex >= 0
          ? data.filter((slot) => slot.key !== activeSlot.key)
          : data;
      const timeConflict = findSlotTimeConflict(otherSlots, draftTime, activeSlot.key);
      if (timeConflict) errors.time = timeConflict;
    }

    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    if (activeSlot) {
      const updatedSlot: TimeSlotData = {
        ...activeSlot,
        title: getTaskTypeTitle(draftType, draftTitle),
        task: draftTask.trim() || draftType,
        taskType: draftType,
        timeSlot: draftTime,
      };
      const slotIndex = data.findIndex((slot) => slot.key === activeSlot.key);
      const nextSlots =
        slotIndex >= 0
          ? data.map((slot) => (slot.key === activeSlot.key ? updatedSlot : slot))
          : [...data, updatedSlot];

      if (onSaveTask) {
        const isEdit = Boolean((activeSlot.task || "").trim() || (activeSlot.title || "").trim());
        if (isEdit) {
          modal.confirm({
            centered: true,
            title: "Confirm Save",
            content: "Are you sure you want to save this timesheet entry?",
            okText: "Save",
            cancelText: "Cancel",
            onOk: async () => {
              setSavingTask(true);
              try {
                await onSaveTask(saveDateKey, nextSlots);
                handleCloseModal();
              } catch {
                // Parent shows error message; keep modal open for retry.
              } finally {
                setSavingTask(false);
              }
            },
          });
        } else {
          setSavingTask(true);
          try {
            await onSaveTask(saveDateKey, nextSlots);
            handleCloseModal();
          } catch {
            // Parent shows error message; keep modal open for retry.
          } finally {
            setSavingTask(false);
          }
        }
        return;
      }

      onSlotUpdate({
        key: activeSlot.key,
        title: updatedSlot.title,
        task: updatedSlot.task,
        taskType: updatedSlot.taskType,
      });
      if (onTimeChange && draftTime !== activeSlot.timeSlot) {
        onTimeChange(draftTime, activeSlot.key);
      }
      handleCloseModal();
    }
  };

  const handleOpenBulkModal = () => {
    if (readOnly) { onReadOnlyClick?.(); return; }
    const initialDrafts: Record<string, string> = {};
    data.forEach(slot => { initialDrafts[slot.key] = slot.task; });
    setBulkDrafts(initialDrafts);
    setIsBulkModalOpen(true);
  };

  const handleSaveBulkModal = async () => {
    const nextSlots = data.map((slot) =>
      bulkDrafts[slot.key] !== undefined
        ? { ...slot, task: bulkDrafts[slot.key] }
        : slot,
    );

    if (onSaveTask) {
      modal.confirm({
        centered: true,
        title: "Confirm Save",
        content: "Are you sure you want to save these timesheet entries?",
        okText: "Save",
        cancelText: "Cancel",
        onOk: async () => {
          setSavingTask(true);
          try {
            await onSaveTask(saveDateKey, nextSlots);
            setIsBulkModalOpen(false);
          } catch {
            // Parent shows error message.
          } finally {
            setSavingTask(false);
          }
        },
      });
      return;
    }

    if (onBulkTaskChange) onBulkTaskChange(bulkDrafts);
    setIsBulkModalOpen(false);
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { handleCloseModal(); setIsBulkModalOpen(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isToday = selectedDate?.isSame(dayjs(), "day") ?? true;
  const headerTitle = isToday
    ? "Today's Timesheet"
    : `Timesheet · ${selectedDate?.format("MMM D, YYYY") ?? ""}`;

  return (
    <>
      {contextHolder}
      <div className="bg-white dark:bg-black rounded-lg shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col mb-16 relative">
        {/* Header */}
        <div className="relative px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F5A623]" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AppstoreOutlined className="text-[#F5A623] text-base" /> {headerTitle}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {readOnly
                ? "Viewing logged tasks for this day. Only today's and yesterday's timesheets can be edited."
                : "Log your tasks for each hourly interval. Click any card to edit."}
            </p>
          </div>
          {selectedDate && onDateChange && (
            <DatePicker
              value={selectedDate}
              onChange={(date) => date && onDateChange(date)}
              allowClear={false}
              disabledDate={(current) =>
                !!current && current > dayjs().endOf("day")
              }
              format="MMM D, YYYY"
              className="rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 h-9 text-xs"
              suffixIcon={<CalendarOutlined className="text-[#F5A623]" />}
            />
          )}
        </div>

        {/* Grid */}
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.map((slot) => (
              <TimeSlotCard
                key={slot.key}
                timeSlot={normalizeTimeSlotRange(slot.timeSlot)}
                title={slot.title}
                task={slot.task}
                isLunch={slot.isLunch}
                onClick={() => handleOpenModal(slot)}
                onDelete={slot.key.startsWith("extra-") && onDeleteSlot ? () => onDeleteSlot(slot.key) : undefined}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && getNextSlotDraft && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenModal(getNextSlotDraft(saveDateKey));
                }}
                className="flex flex-col items-center justify-center h-full min-h-[100px] p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:border-[#F5A623]/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover:bg-[#F5A623]/10 flex items-center justify-center mb-1.5 transition-colors">
                  <span className="text-lg text-gray-400 group-hover:text-[#F5A623] transition-colors">+</span>
                </div>
                <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Add Time Slot</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Task Entry Modal ── */}
      {activeSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {activeSlot && isDraftSlot(activeSlot) ? "Add Time Slot" : "Log Task Details"}
              </h3>
              <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors">
                <CloseOutlined />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Time Slot */}
              <div>
                <label className={LABEL_BASE}>Time Slot</label>
                <div className="flex items-center gap-3">
                  <TimeSpinnerInput
                    value={(() => { const p = draftTime.split(" - "); return p.length === 2 ? p[0] : "00:00"; })()}
                    onChange={(val) => { const p = draftTime.split(" - "); setDraftTime(`${val} - ${p[1] || ""}`); if (formErrors.time) setFormErrors(p => ({ ...p, time: undefined })); }}
                    className="flex-1"
                  />
                  <span className="font-medium text-gray-400">to</span>
                  <TimeSpinnerInput
                    value={(() => { const p = draftTime.split(" - "); return p.length === 2 ? p[1] : "00:00"; })()}
                    onChange={(val) => { const p = draftTime.split(" - "); setDraftTime(`${p[0] || ""} - ${val}`); if (formErrors.time) setFormErrors(p => ({ ...p, time: undefined })); }}
                    className="flex-1"
                  />
                </div>
                {formErrors.time && <p className="mt-1 text-xs text-red-500">{formErrors.time}</p>}
              </div>

              {/* Type — required primary field */}
              <div>
                <label className={LABEL_BASE}>
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDraftType(opt.value);
                        if (!isCustomTaskType(opt.value)) setFormErrors(p => ({ ...p, title: undefined }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${draftType === opt.value
                        ? "text-white border-transparent shadow-md"
                        : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400"
                        }`}
                      style={draftType === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title — only shown when Custom is selected */}
              {isCustomTaskType(draftType) && (
                <div>
                  <label className={LABEL_BASE}>
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={draftTitle}
                    onChange={(e) => { setDraftTitle(e.target.value); if (formErrors.title) setFormErrors(p => ({ ...p, title: undefined })); }}
                    placeholder="Enter a custom title..."
                    className={`${INPUT_BASE} ${formErrors.title ? "border-red-400 focus:ring-red-400/30 focus:border-red-400" : "border-gray-200 dark:border-zinc-700"}`}
                  />
                  {formErrors.title && <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>}
                </div>
              )}

              {/* Description */}
              <div>
                <label className={LABEL_BASE}>
                  Description
                  {!isOptionalDescriptionTaskType(draftType) && <span className="text-red-500"> *</span>}
                  {isOptionalDescriptionTaskType(draftType) && <span className="text-gray-400 text-[10px] font-normal ml-1">(optional)</span>}
                </label>
                <textarea
                  value={draftTask}
                  onChange={(e) => { setDraftTask(e.target.value); if (formErrors.task) setFormErrors(p => ({ ...p, task: undefined })); }}
                  placeholder={isOptionalDescriptionTaskType(draftType) ? "Any notes? (optional)" : "What did you work on during this time?"}
                  rows={4}
                  className={`${INPUT_BASE} resize-none ${formErrors.task ? "border-red-400 focus:ring-red-400/30 focus:border-red-400" : "border-gray-200 dark:border-zinc-700"}`}
                />
                <div className="mt-1 flex items-center justify-between">
                  {formErrors.task
                    ? <p className="text-xs text-red-500">{formErrors.task}</p>
                    : <span />}
                  {!isOptionalDescriptionTaskType(draftType) && (
                    <span className={`text-xs font-medium tabular-nums ${draftTask.trim().split(/\s+/).filter(Boolean).length >= 10
                      ? "text-green-500"
                      : "text-gray-400"
                      }`}>
                      {draftTask.trim() === "" ? 0 : draftTask.trim().split(/\s+/).filter(Boolean).length}/10 words
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50/80 dark:bg-zinc-900/80 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
              <button onClick={handleCloseModal} className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveModal} disabled={savingTask} className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#F5A623] hover:bg-[#E0931B] text-white shadow-md shadow-[#F5A623]/20 hover:shadow-lg transition-all active:scale-95 disabled:opacity-60">
                {savingTask ? "Saving..." : "Save Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Modal ── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quick Fill Timesheet</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-500 transition-colors">
                <CloseOutlined />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {data.map(slot => (
                <div key={slot.key} className="grid grid-cols-12 gap-4 items-center border-b border-gray-100 dark:border-zinc-800/50 pb-4 last:border-0 last:pb-0">
                  <div className="col-span-12 sm:col-span-4">
                    <span className="text-sm font-semibold text-[#F5A623]">{slot.timeSlot}</span>
                  </div>
                  <div className="col-span-12 sm:col-span-8">
                    <input
                      value={bulkDrafts[slot.key] || ""}
                      onChange={(e) => setBulkDrafts(prev => ({ ...prev, [slot.key]: e.target.value }))}
                      placeholder="Enter task description..."
                      className={INPUT_BASE + " border-gray-200 dark:border-zinc-700"}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50/80 dark:bg-zinc-900/80 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handleSaveBulkModal} className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#F5A623] hover:bg-[#E0931B] text-white shadow-md shadow-[#F5A623]/20 hover:shadow-lg transition-all active:scale-95">Save All</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
