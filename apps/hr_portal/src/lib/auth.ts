export type UserRole = "admin" | "hrbp" | "manager" | "employee";

const REMEMBER_LOGIN_KEY = "hr_portal_remember_login";

export interface RememberedLogin {
  emailPrefix: string;
  emailDomain: string;
}

export function getRememberedLogin(): RememberedLogin | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed.emailPrefix?.trim() || !parsed.emailDomain?.trim()) return null;

    return {
      emailPrefix: parsed.emailPrefix,
      emailDomain: parsed.emailDomain,
    };
  } catch {
    return null;
  }
}

export function setRememberedLogin(data: RememberedLogin): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify(data));
}

export function clearRememberedLogin(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REMEMBER_LOGIN_KEY);
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    let payload = parts[1];
    const pad = payload.length % 4;
    if (pad) payload += "=".repeat(4 - pad);
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;

  const payload = decodeTokenPayload(token);
  if (!payload) return false;

  const exp = payload.exp;
  if (typeof exp === "number" && exp * 1000 < Date.now()) return false;

  return true;
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

/** Hard navigation to a clean /login (no query params, no stale client state). */
export function redirectToLoginPage(): void {
  if (typeof window === "undefined") return;
  // trailingSlash: true (static export) means the real pathname is "/login/", not "/login".
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
  if (currentPath === "/login" && !window.location.search) return;
  window.location.replace("/login");
}

export function logoutAndRedirectToLogin(): void {
  clearAuthSession();
  redirectToLoginPage();
}

export function getTokenRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;

  const payload = decodeTokenPayload(token);
  if (!payload) return null;

  const role = payload.role;
  if (
    role === "admin" ||
    role === "hrbp" ||
    role === "manager" ||
    role === "employee"
  ) {
    return role;
  }
  return "employee";
}

export function canAccessTimesheet(role: UserRole | null): boolean {
  return role !== "admin";
}

export function canAccessTeam(role: UserRole | null): boolean {
  return role === "admin" || role === "hrbp" || role === "manager";
}

export function canAccessReports(role: UserRole | null): boolean {
  return role === "admin" || role === "hrbp" || role === "manager";
}

export function canAccessDashboard(role: UserRole | null): boolean {
  return role === "admin";
}

export function canAccessAnalytics(role: UserRole | null): boolean {
  return role === "admin";
}

export function canAccessPersonalDashboard(role: UserRole | null): boolean {
  return role === "employee" || role === "manager" || role === "hrbp";
}

export function getRoleLabel(role: UserRole | null, alsoManager = false): string {
  if (role === "admin") return "Admin / HR";
  if (role === "hrbp") {
    return alsoManager ? "HRBP / Manager" : "HR Business Partner";
  }
  if (role === "manager") return "Manager";
  return "Employee";
}

/** Prefer HR job title for display; fall back to portal role label. */
export function getProfileDisplayTitle(
  jobTitle: string | null | undefined,
  role: UserRole | null,
  alsoManager = false,
): string {
  const title = jobTitle?.trim();
  if (title && title !== "—") return title;
  return getRoleLabel(role, alsoManager);
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function splitNameWords(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

function isInitialToken(token: string): boolean {
  return token === "." || /^[a-zA-Z]\.?$/.test(token);
}

/** Friendly first name for greetings and header (handles initials and dotted names). */
export function getDisplayFirstName(name: string): string {
  const cleaned = name.trim();
  if (!cleaned || cleaned === "—") return "User";

  const words = splitNameWords(cleaned);
  let index = 0;
  while (index < words.length - 1 && isInitialToken(words[index])) {
    index += 1;
  }

  if (index < words.length) {
    return capitalizeWord(words[index]);
  }

  const single = words[0] ?? cleaned;
  if (single.includes(".")) {
    const segments = single.split(".").filter(Boolean);
    if (segments.length > 1) {
      return capitalizeWord(single);
    }
  }

  return capitalizeWord(single);
}

export function getNameInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned || cleaned === "—") return "U";

  const displayName = getDisplayFirstName(cleaned);
  const displayWords = splitNameWords(displayName);
  if (displayWords.length >= 2) {
    return `${displayWords[0][0] ?? ""}${displayWords[1][0] ?? ""}`.toUpperCase();
  }

  const word = displayWords[0] ?? displayName;
  if (word.includes(".")) {
    const segments = word.split(".").filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0][0] ?? ""}${segments[segments.length - 1][0] ?? ""}`.toUpperCase();
    }
  }

  return word.slice(0, 2).toUpperCase();
}

export function getFirstName(name: string): string {
  return getDisplayFirstName(name);
}
