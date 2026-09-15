/**
 * Formats a given number of hours into a human-readable string:
 * e.g., 8.1667 -> "8hrs 10mins", 8 -> "8hrs", 0.5 -> "30mins", 0 -> "0hrs"
 */
export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(h) || h <= 0) return "0hrs";
  const totalMinutes = Math.round(h * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}hrs ${mins}mins`;
  if (hrs > 0) return `${hrs}hrs`;
  if (mins > 0) return `${mins}mins`;
  return "0hrs";
}

export const formatDuration = fmtHours;
