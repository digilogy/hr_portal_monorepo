import { clearAuthSession, redirectToLoginPage } from "@/lib/auth";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5111";

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearAuthSession();
    redirectToLoginPage();
    throw new Error(data.message || "Session expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data as T;
}

export async function downloadFile(
  path: string,
  fileName: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearAuthSession();
    redirectToLoginPage();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Download failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
