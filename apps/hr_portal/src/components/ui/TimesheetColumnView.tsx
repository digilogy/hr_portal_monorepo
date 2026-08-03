/**
 * @file TimesheetColumnView.tsx
 * @description Unified horizontal table view showing today and all historical days.
 *              Today's tasks can be edited; past days are read-only.
 */

"use client";

import React, { useState } from "react";
import dayjs from "dayjs";
import { CheckCircleOutlined, TableOutlined, CloseOutlined, EditOutlined } from "@ant-design/icons";
import { Modal, Button } from "antd";
import {
  TaskType,
  TASK_TYPE_OPTIONS,
  getTaskTypeTitle,
  isCustomTaskType,
  isOptionalDescriptionTaskType,
} from "@/lib/taskTypes";
import { TimeSlotData } from "./TimesheetGrid";
import { TimeSpinnerInput } from "./TimeSpinnerInput";
import { findSlotTimeConflict, getSlotDurationHours, normalizeTimeSlotRange } from "@/lib/timesheetSlots";

const INPUT_BASE =
  "w-full px-4 py-2.5 border rounded-xl bg-gray-50 dark:bg-zinc-900/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40 focus:border-[#F5A623] transition-all text-sm";

const LABEL_BASE =
  "text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1";

export interface HistoricalTask {
  timeSlot: string;
  title?: string;
  task: string;
  taskType?: TaskType;
}

export interface HistoricalDay {
  dateStr: string;
  totalHours: number;
  tasks: HistoricalTask[];
}

export interface TimesheetDayView {
  dateKey: string;
  dateStr: string;
  totalHours: number;
  slots: TimeSlotData[];
  isToday: boolean;
}

interface TimesheetColumnViewProps {
  days: TimesheetDayView[];
  onSaveTask?: (dateKey: string, slots: TimeSlotData[]) => Promise<void>;
  onReadOnlyClick?: () => void;
  getNextSlotDraft?: (dateKey: string) => TimeSlotData;
}

export const TimesheetColumnView: React.FC<TimesheetColumnViewProps> = ({
  days,
  onSaveTask,
  onReadOnlyClick,
  getNextSlotDraft,
}) => {
  const getSlotDisplayTitle = (slot: {
    taskType?: string;
    title?: string;
  }) => {
    if (isCustomTaskType(slot.taskType) && slot.title) return slot.title;
    return slot.taskType || slot.title || "";
  };

  const truncateWords = (text: string, maxWords = 3) => {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    return words.length > maxWords ? words.slice(0, maxWords).join(" ") + "…" : text;
  };

  const truncateTitle = (text: string, maxWords = 4, maxChars = 40) => {
    if (!text) return "";
    const trimmed = text.trim();
    const byWords = truncateWords(trimmed, maxWords);
    if (byWords.length <= maxChars) return byWords;
    return trimmed.slice(0, maxChars).trimEnd() + "…";
  };

  const calculateHours = (slot: string) => {
    const hours = getSlotDurationHours(slot);
    if (hours <= 0) return "";
    return parseFloat(hours.toFixed(1)) + " hrs";
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSlot, setActiveSlot] = useState<TimeSlotData | null>(null);
  const [activeDaySlots, setActiveDaySlots] = useState<TimeSlotData[]>([]);
  const [activeDateKey, setActiveDateKey] = useState("");
  const [activeDateStr, setActiveDateStr] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTask, setDraftTask] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftType, setDraftType] = useState<TaskType>("Custom");
  const [formErrors, setFormErrors] = useState<{ title?: string; task?: string; time?: string }>({});
  const [savingTask, setSavingTask] = useState(false);
  const [modal, contextHolder] = Modal.useModal();

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setActiveSlot(null);
    setActiveDaySlots([]);
    setActiveDateKey("");
    setActiveDateStr("");
    setDraftTitle("");
    setDraftTask("");
    setDraftTime("");
    setFormErrors({});
  };

  const openSlotModal = (slot: TimeSlotData, day: TimesheetDayView) => {
    const normalizedTimeSlot = normalizeTimeSlotRange(slot.timeSlot);
    const isEditableDay = day.isToday || dayjs(day.dateKey).isSame(dayjs().subtract(1, 'day'), 'day');

    if (isEditableDay && onSaveTask) {
      setIsEditMode(true);
      setActiveSlot(slot);
      setActiveDaySlots(day.slots);
      setActiveDateKey(day.dateKey);
      setActiveDateStr(day.dateStr);
      setDraftTitle(slot.title && isCustomTaskType(slot.taskType) ? slot.title : "");
      setDraftTask(slot.task || "");
      setDraftTime(normalizedTimeSlot);
      setDraftType(slot.taskType ?? "Custom");
      setFormErrors({});
      setIsModalOpen(true);
      return;
    }

    if (isEditableDay && !onSaveTask) {
      onReadOnlyClick?.();
      return;
    }

    setIsEditMode(false);
    setActiveSlot(slot);
    setActiveDateKey(day.dateKey);
    setActiveDateStr(day.dateStr);
    setDraftTime(normalizedTimeSlot);
    setIsModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!activeSlot || !onSaveTask || !activeDateKey) return;

    const errors: { title?: string; task?: string; time?: string } = {};
    if (isCustomTaskType(draftType) && !draftTitle.trim()) {
      errors.title = "Title is required for Custom type.";
    }
    if (!isOptionalDescriptionTaskType(draftType)) {
      const wordCount = draftTask.trim().split(/\s+/).filter(Boolean).length;
      if (!draftTask.trim()) errors.task = "Description is required.";
      else if (wordCount < 10) {
        errors.task = `Description must be at least 10 words (${wordCount}/10).`;
      }
    }

    const timeConflict = findSlotTimeConflict(
      activeDaySlots.filter((slot) => slot.key !== activeSlot.key),
      draftTime,
      activeSlot.key,
    );
    if (timeConflict) errors.time = timeConflict;

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const updatedSlot: TimeSlotData = {
      ...activeSlot,
      title: getTaskTypeTitle(draftType, draftTitle),
      task: draftTask.trim(),
      taskType: draftType,
      timeSlot: draftTime,
    };

    const slotIndex = activeDaySlots.findIndex((slot) => slot.key === activeSlot.key);
    const nextSlots = slotIndex >= 0
      ? activeDaySlots.map((slot) => (slot.key === activeSlot.key ? updatedSlot : slot))
      : [...activeDaySlots, updatedSlot];

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
            await onSaveTask(activeDateKey, nextSlots);
            closeModal();
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
        await onSaveTask(activeDateKey, nextSlots);
        closeModal();
      } catch {
        // Parent shows error message; keep modal open for retry.
      } finally {
        setSavingTask(false);
      }
    }
  };

  let maxTasks = 1;
  days.forEach((day) => {
    const filledCount = day.slots.filter(
      (slot) => slot.task?.trim() || slot.title?.trim(),
    ).length;
    
    // Ensure there is an extra column for the "Add Slot" button if it's today
    const isEditableDay = day.isToday || dayjs(day.dateKey).isSame(dayjs().subtract(1, 'day'), 'day');
    const requiredCols = (isEditableDay && onSaveTask && getNextSlotDraft) ? filledCount + 1 : filledCount;
    if (requiredCols > maxTasks) maxTasks = requiredCols;
  });
  const columns = Array.from({ length: maxTasks }, (_, i) => `Slot ${i + 1}`);

  const renderSlotCell = (slot: TimeSlotData | undefined, day: TimesheetDayView, isNextEmptySlot: boolean) => {
    const isEditableDay = day.isToday || dayjs(day.dateKey).isSame(dayjs().subtract(1, 'day'), 'day');
    const canEdit = isEditableDay && !!onSaveTask;

    if (isNextEmptySlot && canEdit && getNextSlotDraft) {
      return (
        <div
          onClick={() => openSlotModal(getNextSlotDraft(day.dateKey), day)}
          className="min-h-[36px] py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 cursor-pointer hover:border-[#F5A623] hover:bg-[#F5A623]/5 transition-all group"
        >
          <span className="text-gray-400 group-hover:text-[#F5A623] text-lg leading-none transition-colors">+</span>
          <span className="text-xs text-gray-400 group-hover:text-[#F5A623] transition-colors font-medium">Add Slot</span>
        </div>
      );
    }

    if (!slot) {
      return (
        <div className="text-[11px] text-gray-300 dark:text-zinc-700 text-center py-1.5">—</div>
      );
    }

    const displayTimeSlot = normalizeTimeSlotRange(slot.timeSlot);

    return (
      <div
        onClick={() => openSlotModal(slot, day)}
        className={`min-h-[36px] py-1.5 px-2 rounded-lg border border-transparent transition-all cursor-pointer hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 group flex flex-col justify-start ${
          canEdit ? "hover:border-[#F5A623]/40" : ""
        }`}
      >
        {(slot.taskType || slot.title || slot.task) ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
              <div
                className="text-[11px] text-gray-900 dark:text-gray-100 font-semibold leading-tight mt-0.5 min-w-0 flex-1 truncate"
                title={getSlotDisplayTitle(slot)}
              >
                {truncateTitle(getSlotDisplayTitle(slot))}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <EditOutlined className="text-[10px] text-[#F5A623] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="text-[9px] font-bold text-[#F5A623] bg-[#F5A623]/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {calculateHours(slot.timeSlot)}
                </div>
              </div>
            </div>
            {slot.task && (
              <div className="text-[11px] text-gray-400 dark:text-zinc-500">
                {truncateWords(slot.task)}
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-gray-300 dark:text-zinc-600 italic group-hover:text-gray-400 transition-colors">
            No details
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-black rounded-lg shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col mb-16 relative w-full overflow-hidden">
      {contextHolder}
      <div className="relative px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F5A623]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TableOutlined className="text-[#F5A623] text-base" /> Unified Timesheet
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Click today&apos;s or yesterday&apos;s tasks to edit. Older days are read-only.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-max border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-zinc-900/50">
              <th className="p-3 border-b border-r border-gray-100 dark:border-zinc-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[130px] align-middle bg-gray-50/80 dark:bg-zinc-900/80 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                Date
              </th>
              {columns.map((col) => (
                <th
                  key={`head-${col}`}
                  className="p-3 border-b border-r border-gray-100 dark:border-zinc-800 text-[10px] font-bold text-[#F5A623] tracking-wider whitespace-nowrap min-w-[180px] max-w-[220px] align-middle"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-8 text-center text-xs text-gray-400"
                >
                  No days in the selected range.
                </td>
              </tr>
            ) : (
              days.map((day) => {
                const filledSlots = day.slots.filter(
                  (slot) => slot.task?.trim() || slot.title?.trim(),
                );

                return (
                  <tr
                    key={day.dateKey}
                    className="hover:bg-gray-50/30 dark:hover:bg-zinc-900/10 transition-colors"
                  >
                    <td className="px-3 py-1.5 border-b border-r border-gray-100 dark:border-zinc-800 align-middle bg-white dark:bg-black sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div
                          className={`font-semibold text-xs ${day.isToday ? "text-[#F5A623]" : "text-gray-800 dark:text-gray-200"}`}
                        >
                          {day.dateStr}
                          {day.isToday && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-[#F5A623] bg-[#F5A623]/10 px-1.5 py-0.5 rounded-md">
                              Today
                            </span>
                          )}
                        </div>
                        {day.totalHours > 0 && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <CheckCircleOutlined className="text-green-500 text-[9px]" />
                            <span className="text-[9px] font-bold text-green-700 dark:text-green-400">
                              {day.totalHours} hrs
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    {columns.map((col, index) => (
                      <td
                        key={`${day.dateKey}-${col}`}
                        className="px-3 py-1.5 border-b border-r border-gray-100 dark:border-zinc-800 align-top min-w-[180px] max-w-[220px]"
                      >
                        {renderSlotCell(filledSlots[index], day, index === filledSlots.length)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {isEditMode ? "Edit Task" : normalizeTimeSlotRange(activeSlot?.timeSlot ?? "")}
            </span>
            <span className="text-xs text-gray-500 font-medium">{activeDateStr}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={closeModal}
        footer={
          isEditMode
            ? [
                <Button key="cancel" onClick={closeModal}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  loading={savingTask}
                  onClick={() => void handleSaveEdit()}
                  className="bg-[#F5A623] hover:bg-[#D48810] border-none"
                >
                  Save Task
                </Button>,
              ]
            : [
                <Button
                  key="close"
                  type="primary"
                  onClick={closeModal}
                  className="bg-[#F5A623] hover:bg-[#D48810] rounded-full shadow-md border-none"
                >
                  Close
                </Button>,
              ]
        }
        centered
        className="font-sans"
        width={520}
        closeIcon={<CloseOutlined className="text-gray-500" />}
        destroyOnHidden
      >
        {isEditMode && activeSlot ? (
          <div className="space-y-4">
            <div>
              <label className={LABEL_BASE}>Time Slot</label>
              <div className="flex items-center gap-3">
                <TimeSpinnerInput
                  value={(() => {
                    const p = draftTime.split(" - ");
                    return p.length === 2 ? p[0] : "00:00";
                  })()}
                  onChange={(val) => {
                    const p = draftTime.split(" - ");
                    setDraftTime(`${val} - ${p[1] || ""}`);
                    if (formErrors.time) {
                      setFormErrors((prev) => ({ ...prev, time: undefined }));
                    }
                  }}
                  className="flex-1"
                />
                <span className="font-medium text-gray-400">to</span>
                <TimeSpinnerInput
                  value={(() => {
                    const p = draftTime.split(" - ");
                    return p.length === 2 ? p[1] : "00:00";
                  })()}
                  onChange={(val) => {
                    const p = draftTime.split(" - ");
                    setDraftTime(`${p[0] || ""} - ${val}`);
                    if (formErrors.time) {
                      setFormErrors((prev) => ({ ...prev, time: undefined }));
                    }
                  }}
                  className="flex-1"
                />
              </div>
              {formErrors.time && (
                <p className="mt-1 text-xs text-red-500">{formErrors.time}</p>
              )}
            </div>

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
                      if (!isCustomTaskType(opt.value)) {
                        setFormErrors((prev) => ({ ...prev, title: undefined }));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      draftType === opt.value
                        ? "text-white border-transparent shadow-md"
                        : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400"
                    }`}
                    style={
                      draftType === opt.value
                        ? { backgroundColor: opt.color, borderColor: opt.color }
                        : {}
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {isCustomTaskType(draftType) && (
              <div>
                <label className={LABEL_BASE}>
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => {
                    setDraftTitle(e.target.value);
                    if (formErrors.title) {
                      setFormErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  placeholder="Enter a custom title..."
                  className={`${INPUT_BASE} ${
                    formErrors.title
                      ? "border-red-400 focus:ring-red-400/30 focus:border-red-400"
                      : "border-gray-200 dark:border-zinc-700"
                  }`}
                />
                {formErrors.title && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>
                )}
              </div>
            )}

            <div>
              <label className={LABEL_BASE}>
                Description
                {!isOptionalDescriptionTaskType(draftType) && <span className="text-red-500"> *</span>}
                {isOptionalDescriptionTaskType(draftType) && (
                  <span className="text-gray-400 text-[10px] font-normal ml-1">
                    (optional)
                  </span>
                )}
              </label>
              <textarea
                value={draftTask}
                onChange={(e) => {
                  setDraftTask(e.target.value);
                  if (formErrors.task) {
                    setFormErrors((prev) => ({ ...prev, task: undefined }));
                  }
                }}
                placeholder={
                  isOptionalDescriptionTaskType(draftType)
                    ? "Any notes? (optional)"
                    : "What did you work on during this time?"
                }
                rows={4}
                className={`${INPUT_BASE} resize-none ${
                  formErrors.task
                    ? "border-red-400 focus:ring-red-400/30 focus:border-red-400"
                    : "border-gray-200 dark:border-zinc-700"
                }`}
              />
              <div className="mt-1 flex items-center justify-between">
                {formErrors.task ? (
                  <p className="text-xs text-red-500">{formErrors.task}</p>
                ) : (
                  <span />
                )}
                {!isOptionalDescriptionTaskType(draftType) && (
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      draftTask.trim().split(/\s+/).filter(Boolean).length >= 10
                        ? "text-green-500"
                        : "text-gray-400"
                    }`}
                  >
                    {draftTask.trim() === ""
                      ? 0
                      : draftTask.trim().split(/\s+/).filter(Boolean).length}
                    /10 words
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {activeSlot && (activeSlot.title || activeSlot.taskType) && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Task Type
                </div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">
                  {isCustomTaskType(activeSlot.taskType) && activeSlot.title
                    ? activeSlot.title
                    : activeSlot.taskType || activeSlot.title}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Description
              </div>
              <div className="p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[120px] break-words">
                {activeSlot?.task || (
                  <span className="italic text-gray-400">
                    No task logged for this time slot.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
