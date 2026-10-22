import { getTokenEmail } from "@/lib/auth";

// Sends browser-side errors to the API's /api/client-errors endpoint so they show
// up in the /logxz live log viewer (service "web") next to the server logs.

export type ClientErrorType = "render" | "uncaught" | "unhandledrejection" | "api" | "network";

export interface ClientErrorReport {
  type: ClientErrorType;
  message: string;
  stack?: string;
  digest?: string;
  apiPath?: string;
  apiStatus?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5111";

// A broken render loop or a polling call against a dead endpoint can fire the same
// error many times a second; only send each distinct error once per window, and
// stop entirely after a cap for the page session.
const DEDUPE_WINDOW_MS = 30_000;
const MAX_REPORTS_PER_PAGE = 25;
const recentReports = new Map<string, number>();
let reportCount = 0;

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  if (reportCount >= MAX_REPORTS_PER_PAGE) return;

  const key = `${report.type}|${report.message}|${report.apiPath ?? ""}`;
  const now = Date.now();
  const lastSent = recentReports.get(key);
  if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) return;
  recentReports.set(key, now);
  reportCount += 1;

  // Never let reporting itself throw or surface an error to the user.
  try {
    fetch(`${API_BASE}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ...report,
        // Path only: query strings can carry reset/invite tokens.
        page: window.location.pathname,
        user: getTokenEmail() ?? undefined,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

function errorFromUnknown(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: value.message || value.name, stack: value.stack };
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

let globalHandlersInstalled = false;

/** Reports uncaught JS errors and unhandled promise rejections on every page. */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined" || globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    // Resource load failures (img/script 404s) have no `error` and no useful message.
    if (!event.error && !event.message) return;
    const { message, stack } = errorFromUnknown(event.error ?? event.message);
    reportClientError({ type: "uncaught", message, stack });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const { message, stack } = errorFromUnknown(event.reason);
    reportClientError({ type: "unhandledrejection", message, stack });
  });
}
