import { clearAuthSession, redirectToLoginPage } from "@/lib/auth";
import { reportClientError } from "@/lib/errorReporter";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5111";

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// fetch() only rejects when the request never got a response (offline, DNS, CORS,
// server down); report those, then rethrow so callers behave as before.
async function fetchReportingNetworkErrors(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    reportClientError({
      type: "network",
      message: err instanceof Error ? err.message : String(err),
      apiPath: path,
    });
    throw err;
  }
}

// 4xx responses are validation / permission outcomes the UI already handles; only
// server failures are worth reporting from the browser.
function reportServerError(path: string, status: number, message: string | undefined) {
  if (status < 500) return;
  reportClientError({ type: "api", message: message || `HTTP ${status}`, apiPath: path, apiStatus: status });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetchReportingNetworkErrors(path, {
    cache: "no-store",
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
    reportServerError(path, response.status, data.message);
    throw new Error(data.message || "Request failed");
  }
  return data as T;
}

export async function downloadFile(
  path: string,
  fileName: string,
): Promise<void> {
  const response = await fetchReportingNetworkErrors(path, {
    headers: getAuthHeaders(),
  });

  if (response.status === 401) {
    clearAuthSession();
    redirectToLoginPage();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    reportServerError(path, response.status, data.message);
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
