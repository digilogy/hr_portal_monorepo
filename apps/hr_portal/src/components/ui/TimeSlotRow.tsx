import React from 'react';
import { ClockCircleOutlined } from '@ant-design/icons';

interface TimeSlotRowProps {
  timeSlot: string;
  project: string | null;
  task: string;
  onProjectChange: (val: string) => void;
  onTaskChange: (val: string) => void;
  readOnly?: boolean;
  isLunch?: boolean;
}

const PROJECT_OPTIONS = [
  { value: "internal", label: "Internal Operations" },
  { value: "client_a", label: "Client A Project" },
  { value: "client_b", label: "Client B Project" },
  { value: "meeting", label: "Meetings" },
  { value: "break", label: "Break" },
  { value: "lunch", label: "Lunch Break" },
];

export const TimeSlotRow: React.FC<TimeSlotRowProps> = ({
  timeSlot,
  project,
  task,
  onProjectChange,
  onTaskChange,
  readOnly = false,
  isLunch = false,
}) => {
  const isRowDisabled = readOnly || isLunch;

  return (
    <div className={`group flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${isLunch ? 'bg-gray-100/50 dark:bg-zinc-800/30' : ''} ${readOnly ? 'opacity-70' : 'hover:bg-gray-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-gray-100 dark:hover:border-zinc-800'}`}>
      
      {/* Time Slot Display */}
      <div className="w-full md:w-48 flex-shrink-0 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${isRowDisabled ? 'bg-gray-100 dark:bg-zinc-800' : 'bg-[#F5A623]/10 group-hover:scale-110'}`}>
          <ClockCircleOutlined className={`text-lg ${isRowDisabled ? 'text-gray-400' : 'text-[#F5A623]'}`} />
        </div>
        <span className={`font-semibold text-sm tracking-wide ${isRowDisabled ? 'text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {timeSlot}
        </span>
      </div>

      {/* Project Selector */}
      <div className="w-full md:w-64 flex-shrink-0 relative">
        <select
          value={project || ""}
          onChange={(e) => onProjectChange(e.target.value)}
          disabled={isRowDisabled}
          className={`w-full appearance-none border rounded-xl px-4 py-3 outline-none transition-all duration-200 shadow-sm ${
            isRowDisabled 
            ? 'bg-gray-50 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800 text-gray-500 cursor-not-allowed' 
            : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-[#F5A623]/50 focus:border-[#F5A623] cursor-pointer'
          }`}
        >
          <option value="" disabled>Select Project / Category</option>
          {PROJECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isRowDisabled ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>

      {/* Task Description Input */}
      <div className="w-full flex-1 relative">
        <input
          type="text"
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          disabled={isRowDisabled}
          placeholder="What did you work on during this hour?"
          className={`w-full border rounded-xl px-4 py-3 outline-none transition-all duration-200 ${
            isRowDisabled
            ? 'bg-gray-50 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800 text-gray-500 cursor-not-allowed shadow-none'
            : 'bg-gray-50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 focus:bg-white dark:focus:bg-black focus:ring-2 focus:ring-[#F5A623]/50 focus:border-[#F5A623] shadow-inner group-hover:shadow-sm'
          }`}
        />
        {/* Floating indicator when filled */}
        <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-300 ${task.length > 0 && !isLunch ? (readOnly ? 'bg-gray-400' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]') : 'bg-transparent'}`} />
      </div>

    </div>
  );
};
