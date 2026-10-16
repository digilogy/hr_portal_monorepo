import { API_BASE } from "@/lib/api";

export type SystemNoticeType = "info" | "warning" | "error";

export interface ActiveSystemNotice {
  message: string;
  type: SystemNoticeType;
  updatedAt: string;
}

export interface ManagedSystemNotice {
  message: string;
  type: SystemNoticeType;
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Public endpoint (no auth) so it also works on the login page. */
export async function fetchActiveSystemNotice(): Promise<ActiveSystemNotice | null> {
  try {
    const response = await fetch(`${API_BASE}/api/system/notice`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { notice: ActiveSystemNotice | null };
    return data.notice;
  } catch {
    return null;
  }
}
