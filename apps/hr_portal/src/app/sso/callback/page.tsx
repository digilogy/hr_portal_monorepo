"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import {
  getDefaultDashboardPath,
  getTokenRole,
  isAuthenticated,
} from "@/lib/auth";
import { redirectToSsoLogin } from "@/lib/ssoHub";

/**
 * Hub redirects here with ?code=… after HR authorize.
 * Survives React StrictMode double-mount (one-time code + lock).
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("Missing SSO code");
      return;
    }

    const lockKey = `hr_sso_lock_${code}`;
    const doneKey = `hr_sso_done_${code}`;

    const finish = () => {
      const role = getTokenRole();
      router.replace(getDefaultDashboardPath(role));
    };

    if (sessionStorage.getItem(doneKey) || isAuthenticated()) {
      finish();
      return;
    }

    if (sessionStorage.getItem(lockKey)) {
      const interval = window.setInterval(() => {
        if (sessionStorage.getItem(doneKey) || isAuthenticated()) {
          window.clearInterval(interval);
          finish();
        }
      }, 50);
      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (!isAuthenticated()) {
          sessionStorage.removeItem(lockKey);
          setError("SSO sign-in timed out. Please try again from the hub.");
        }
      }, 15000);
      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    }

    sessionStorage.setItem(lockKey, "1");

    void fetch(`${API_BASE}/api/auth/sso/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirectUri: `${window.location.origin}/sso/callback/`,
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            body?.error?.message || body?.message || "SSO sign-in failed",
          );
        }
        const accessToken = body?.data?.accessToken as string | undefined;
        if (!accessToken) throw new Error("SSO sign-in failed — no token");
        localStorage.setItem("token", accessToken);
        sessionStorage.setItem(doneKey, "1");
        finish();
      })
      .catch((err: Error) => {
        sessionStorage.removeItem(lockKey);
        setError(err.message || "SSO sign-in failed");
      });
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
        <p className="text-red-600 text-center max-w-md">{error}</p>
        <button
          type="button"
          className="px-4 py-2 rounded bg-teal-700 text-white"
          onClick={() => redirectToSsoLogin()}
        >
          Back to One Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
      Signing you in…
    </div>
  );
}
