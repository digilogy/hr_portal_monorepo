import React from "react";
import { CalendarOutlined } from "@ant-design/icons";

interface HistoricalTask {
  timeSlot: string;
  task: string;
}

interface HistoricalDay {
  dateStr: string;
  totalHours: number;
  tasks: HistoricalTask[];
}

interface DateWiseTaskHistoryProps {
  historyData?: HistoricalDay[];
}

export const DateWiseTaskHistory: React.FC<DateWiseTaskHistoryProps> = ({
  historyData = [],
}) => {
  const allSlotsSet = new Set<string>();
  historyData.forEach((day) => {
    day.tasks.forEach((task) => allSlotsSet.add(task.timeSlot));
  });
  const columns = Array.from(allSlotsSet);

  if (historyData.length === 0) {
    return (
      <div className="bg-white dark:bg-black rounded-[32px] shadow-sm border border-gray-100 dark:border-zinc-800 p-8 mb-16 text-center text-gray-500">
        No saved timesheet history yet.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black rounded-[32px] shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden mb-16 w-full">
      <div className="p-6 md:p-8 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-zinc-800 flex items-center justify-center text-[#F5A623]">
            <CalendarOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Task History</h2>
            <p className="text-sm text-gray-500">Your previously logged work (Table View)</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-max border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-zinc-900/50">
              <th className="p-4 border-b border-r border-gray-100 dark:border-zinc-800 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[150px] align-middle bg-gray-50/80 dark:bg-zinc-900/80 sticky left-0 z-10">
                Date
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="p-4 border-b border-r border-gray-100 dark:border-zinc-800 text-xs font-bold text-[#F5A623] tracking-wider whitespace-nowrap min-w-[200px] max-w-[250px] align-middle"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historyData.map((day) => (
              <tr
                key={day.dateStr}
                className="hover:bg-gray-50/30 dark:hover:bg-zinc-900/10 transition-colors"
              >
                <td className="p-4 border-b border-r border-gray-100 dark:border-zinc-800 align-top bg-white dark:bg-black sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-2 whitespace-nowrap">
                    {day.dateStr}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md">
                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                      {day.totalHours} hrs logged
                    </span>
                  </div>
                </td>
                {columns.map((col) => {
                  const taskObj = day.tasks.find((task) => task.timeSlot === col);
                  return (
                    <td
                      key={`${day.dateStr}-${col}`}
                      className="p-4 border-b border-r border-gray-100 dark:border-zinc-800 align-top"
                    >
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {taskObj ? (
                          taskObj.task
                        ) : (
                          <span className="text-gray-300 dark:text-zinc-600 italic text-xs">
                            No task
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
