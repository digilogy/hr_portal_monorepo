/** SSO hub — HR Portal silent bridge + single logout */
export const SSO_HUB_URL =
  (process.env.NEXT_PUBLIC_SSO_HUB_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("cgworkflow.com")
      ? "https://sso.cgworkflow.com"
      : process.env.NODE_ENV === "production"
        ? "https://sso.cgworkflow.com"
        : "http://localhost:3110")).replace(/\/$/, "");

export const SSO_HUB_API_URL =
  (process.env.NEXT_PUBLIC_SSO_HUB_API_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("cgworkflow.com")
      ? "https://sso.cgworkflow.com"
      : process.env.NODE_ENV === "production"
        ? "https://sso.cgworkflow.com"
        : "http://localhost:5160")).replace(/\/$/, "");

export type HubSessionInfo = {
  email: string;
  name: string;
  id: string;
};

export function hrSsoAuthorizeUrl(): string {
  // trailingSlash: true → /sso/callback/
  const redirectUri = `${window.location.origin}/sso/callback/`;
  const url = new URL(`${SSO_HUB_API_URL}/authorize`);
  url.searchParams.set("client_id", "client-hr");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export function redirectToSsoLogin(): void {
  window.location.href = `${SSO_HUB_URL}/login`;
}

export function redirectToHubAuthorize(): void {
  window.location.href = hrSsoAuthorizeUrl();
}

export async function fetchHubSession(): Promise<HubSessionInfo | null> {
  try {
    const res = await fetch(`${SSO_HUB_API_URL}/session`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: { id?: string; email?: string; name?: string };
    };
    if (!data.authenticated || !data.user?.email) return null;
    return {
      id: data.user.id ?? "",
      email: data.user.email.toLowerCase(),
      name: data.user.name ?? "",
    };
  } catch {
    return null;
  }
}

export async function isHubSessionActive(): Promise<boolean | null> {
  try {
    const res = await fetch(`${SSO_HUB_API_URL}/session`, { credentials: "include" });
    if (res.status === 401) return false;
    if (!res.ok) return null;
    return true;
  } catch {
    return null;
  }
}

/** No local HR session: hub → silent authorize; else SSO login. */
export async function bridgeFromHubOrLogin(): Promise<boolean> {
  const hub = await fetchHubSession();
  if (hub) {
    redirectToHubAuthorize();
    return true;
  }
  redirectToSsoLogin();
  return true;
}

export function clearHrLocalSession(): void {
  localStorage.removeItem("token");
}

export async function logoutToSsoHub(): Promise<void> {
  try {
    await fetch(`${SSO_HUB_API_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  clearHrLocalSession();
  redirectToSsoLogin();
}

/**
 * Hub gone OR hub email ≠ local HR user → onDead once.
 */
export function startHubSessionWatch(
  onDead: () => void,
  options?: { localEmail?: string | null },
): () => void {
  let dead = false;
  const logoutReadyAt = Date.now() + 2500;
  const localEmail = options?.localEmail?.toLowerCase().trim() || null;

  const check = async () => {
    if (dead || document.visibilityState === "hidden") return;

    const hub = await fetchHubSession();
    if (hub) {
      if (localEmail && hub.email !== localEmail) {
        dead = true;
        onDead();
      }
      return;
    }

    if (Date.now() < logoutReadyAt) return;
    const active = await isHubSessionActive();
    if (active === false) {
      dead = true;
      onDead();
    }
  };

  void check();
  const onFocus = () => void check();
  const onVis = () => {
    if (document.visibilityState === "visible") void check();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);
  const interval = window.setInterval(() => void check(), 8000);

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
    window.clearInterval(interval);
  };
}
