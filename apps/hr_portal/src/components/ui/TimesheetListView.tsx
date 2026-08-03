import React, { useState } from "react";
import { EditOutlined, LockOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Modal, Input, Button } from "antd";

export interface TimeSlotData {
  key: string;
  timeSlot: string;
  task: string;
  isLunch?: boolean;
}

interface TimesheetListViewProps {
  currentDateStr: string;
  data: TimeSlotData[];
  onTaskChange: (val: string, key: string) => void;
  onAddSlot?: () => void;
  onDeleteSlot?: (key: string) => void;
  readOnly?: boolean;
}

export const TimesheetListView: React.FC<TimesheetListViewProps> = ({
  currentDateStr,
  data,
  onTaskChange,
  onAddSlot,
  onDeleteSlot,
  readOnly = false,
}) => {
  const truncateWords = (text: string, maxWords: number = 3) => {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    if (words.length > maxWords) {
      return words.slice(0, maxWords).join(" ") + "...";
    }
    return text;
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    dateStr: string;
    timeSlot: string;
    task: string;
    isEditable: boolean;
    key?: string;
  } | null>(null);
  const [modalInputValue, setModalInputValue] = useState("");

  const handleOpenModal = (slot: TimeSlotData) => {
    setSelectedSlot({
      dateStr: currentDateStr,
      timeSlot: slot.timeSlot,
      task: slot.task || "",
      isEditable: !readOnly,
      key: slot.key
    });
    setModalInputValue(slot.task || "");
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-black rounded-lg shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col mb-16 relative w-full overflow-hidden">
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-[150px]">
                Date
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-[220px]">
                Time Slot
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Task Description
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center w-[100px]">
                Hours
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center w-[120px]">
                Status
              </th>
              <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center w-[100px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {data.map((slot) => {
              const isFilled = slot.task.trim().length > 0;
              const isExtra = slot.key.startsWith("extra-");

              return (
                <tr 
                  key={slot.key}
                  onClick={() => handleOpenModal(slot)}
                  className="group transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer"
                >
                  {/* Date */}
                  <td className="px-6 py-5 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {currentDateStr}
                  </td>

                  {/* Time Slot */}
                  <td className="px-6 py-5 text-sm font-bold text-gray-800 dark:text-gray-200">
                    {slot.timeSlot}
                  </td>

                  {/* Task Description */}
                  <td className="px-6 py-5">
                    {isFilled ? (
                      <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {truncateWords(slot.task)}
                      </div>
                    ) : (
                      <span className="text-sm italic text-gray-400 group-hover:text-gray-500 transition-colors">
                        Click to enter task details...
                      </span>
                    )}
                  </td>

                  {/* Hours */}
                  <td className="px-6 py-5 text-sm font-bold text-gray-800 dark:text-gray-200 text-center">
                    {isFilled ? "1" : "0"}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-5 text-center">
                    {isFilled ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-800/30">
                        Filled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-100 dark:border-orange-800/30">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-6 py-5 text-center">
                    <div className="flex justify-center items-center gap-3">
                      <button 
                        className="text-blue-400 hover:text-blue-600 transition-colors p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(slot);
                        }}
                      >
                        <EditOutlined className="text-base" />
                      </button>
                      {isExtra && onDeleteSlot && !readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSlot(slot.key);
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="Delete slot"
                        >
                          <DeleteOutlined className="text-base" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Add Slot Button Row */}
        {!readOnly && onAddSlot && (
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex justify-center">
             <button
                onClick={onAddSlot}
                className="flex items-center gap-2 text-sm font-bold text-[#F5A623] hover:text-[#D48810] bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 transition-colors px-6 py-2.5 rounded-full"
              >
                <PlusOutlined /> Add Overtime Slot
              </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedSlot?.timeSlot}</span>
            <span className="text-xs text-gray-500 font-medium">{selectedSlot?.dateStr}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={selectedSlot?.isEditable ? [
          <Button key="cancel" onClick={() => setIsModalOpen(false)} className="rounded-full">Cancel</Button>,
          <Button key="save" type="primary" onClick={() => {
            if (selectedSlot.key) {
              onTaskChange(modalInputValue, selectedSlot.key);
            }
            setIsModalOpen(false);
          }} className="bg-[#F5A623] hover:bg-[#D48810] rounded-full shadow-md border-none">Save Task</Button>
        ] : [
          <Button key="close" type="primary" onClick={() => setIsModalOpen(false)} className="bg-[#F5A623] hover:bg-[#D48810] rounded-full shadow-md border-none">Close</Button>
        ]}
        centered
        className="font-sans"
        width={500}
      >
        <div className="py-4">
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Task Details</div>
          {selectedSlot?.isEditable ? (
            <Input.TextArea
              value={modalInputValue}
              onChange={(e) => setModalInputValue(e.target.value)}
              rows={5}
              placeholder="Enter comprehensive task details..."
              className="w-full bg-gray-50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700 focus:border-[#F5A623] focus:shadow-[0_0_0_2px_rgba(245,166,35,0.1)] rounded-xl resize-none text-base"
            />
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[120px]">
              {selectedSlot?.task || <span className="italic text-gray-400">No task logged for this time slot.</span>}
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};
