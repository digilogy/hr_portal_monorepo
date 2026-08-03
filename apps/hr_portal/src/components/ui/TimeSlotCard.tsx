import React from "react";
import { CoffeeOutlined, PlusOutlined, ClockCircleOutlined } from "@ant-design/icons";

interface TimeSlotCardProps {
  timeSlot: string;
  task: string;
  title?: string;
  isLunch?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export const TimeSlotCard: React.FC<TimeSlotCardProps> = ({
  timeSlot,
  task,
  title,
  onClick,
  onDelete,
  readOnly = false,
}) => {
  const isFilled = (task || "").trim().length > 0 || (title || "").trim().length > 0;
  const hoverTitle = title ? `${title}${task ? ` — ${task}` : ""}` : task;

  return (
    <div
      onClick={!readOnly ? onClick : undefined}
      className={`relative flex flex-col h-full min-h-[100px] p-4 rounded-2xl bg-white dark:bg-black transition-all duration-300 ${
        !readOnly ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-[#F5A623]/10" : ""
      } ${
        isFilled
          ? "border border-gray-200 dark:border-zinc-800 shadow-sm"
          : "border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/20"
      }`}
    >
      {/* Accent line for filled state */}
      {isFilled && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-[#F5A623] rounded-r-full" />
      )}

      {/* Time Label & Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-gray-400 text-xs" />
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
            {timeSlot}
          </span>
        </div>
        
        {onDelete && !readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Delete extra time slot"
          >
            <svg viewBox="64 64 896 896" focusable="false" fill="currentColor" width="1em" height="1em" data-icon="delete" aria-hidden="true"><path d="M267.3 755.7V834c0 14.3 11.7 26 26 26h437.4c14.3 0 26-11.7 26-26V755.7H267.3zM854 263.2H666.2V225c0-39.7-32.3-72-72-72H429.8c-39.7 0-72 32.3-72 72v38.2H170c-14.3 0-26 11.7-26 26v41.9c0 14.3 11.7 26 26 26h18v473c0 48.6 39.4 88 88 88h437.4c48.6 0 88-39.4 88-88v-473h18c14.3 0 26-11.7 26-26v-41.9c0-14.3-11.7-26-26-26zM435.8 225c0-4.4 3.6-8 8-8h136.4c4.4 0 8 3.6 8 8v38.2H435.8V225zm338 584.4c0 13.2-10.8 24-24 24H274.2c-13.2 0-24-10.8-24-24v-473h523.6v473zM512 400.6c-17.7 0-32 14.3-32 32v247.3c0 17.7 14.3 32 32 32s32-14.3 32-32V432.6c0-17.7-14.3-32-32-32zM369 400.6c-17.7 0-32 14.3-32 32v247.3c0 17.7 14.3 32 32 32s32-14.3 32-32V432.6c0-17.7-14.3-32-32-32zM655 400.6c-17.7 0-32 14.3-32 32v247.3c0 17.7 14.3 32 32 32s32-14.3 32-32V432.6c0-17.7-14.3-32-32-32z"></path></svg>
          </button>
        )}
      </div>

      {/* Task Content */}
      <div className="flex-1 flex flex-col justify-center">
        {isFilled ? (
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug line-clamp-2" title={hoverTitle}>
            {title && <span className="font-bold">{title}</span>}
            {title && task && " — "}
            {task}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
            <PlusOutlined className="text-xs" />
            <span className="text-xs font-medium">Add task</span>
          </div>
        )}
      </div>
    </div>
  );
};
