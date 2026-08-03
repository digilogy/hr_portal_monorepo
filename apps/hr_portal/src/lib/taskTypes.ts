export type TaskType = "Meeting" | "Lunch" | "Travel" | "Break" | "BAU" | "Custom";

export const TASK_TYPE_OPTIONS: {
  value: TaskType;
  label: string;
  color: string;
}[] = [
  { value: "Meeting", label: "Meeting", color: "#6366F1" },
  { value: "Lunch", label: "Lunch", color: "#22C55E" },
  { value: "Travel", label: "Travel", color: "#F59E0B" },
  { value: "Break", label: "Break", color: "#EC4899" },
  { value: "BAU", label: "BAU", color: "#0EA5E9" },
  { value: "Custom", label: "Custom", color: "#F5A623" },
];

export function isCustomTaskType(taskType?: TaskType | string): boolean {
  return taskType === "Custom";
}

export function isLunchTaskType(taskType?: TaskType | string): boolean {
  return taskType === "Lunch";
}

export function isOptionalDescriptionTaskType(taskType?: TaskType | string): boolean {
  return taskType === "Lunch" || taskType === "Break";
}

export function getTaskTypeTitle(
  taskType: TaskType,
  customTitle: string,
): string {
  return isCustomTaskType(taskType) ? customTitle.trim() : taskType;
}
