"use client";

import React, { useEffect, useState } from "react";
import { Alert } from "antd";
import { ToolOutlined, ExclamationCircleOutlined, InfoCircleOutlined, LockOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { clearAuthSession } from "@/lib/auth";
import { fetchActiveSystemNotice, type ActiveSystemNotice } from "@/lib/systemNotice";

const POLL_INTERVAL_MS = 60_000;

/** Login URL that skips the maintenance screen so the superadmin can sign in. */
export const ADMIN_LOGIN_PATH = "/login/?admin=1";

const NOTICE_STYLES: Record<
  ActiveSystemNotice["type"],
  { label: string; color: string; tint: string; icon: React.ReactNode }
> = {
  info: {
    label: "Scheduled maintenance",
    color: "#2563eb",
    tint: "rgba(37, 99, 235, 0.1)",
    icon: <InfoCircleOutlined />,
  },
  warning: {
    label: "Maintenance in progress",
    color: "#F5A623",
    tint: "rgba(245, 166, 35, 0.12)",
    icon: <ToolOutlined />,
  },
  error: {
    label: "Service disruption",
    color: "#dc2626",
    tint: "rgba(220, 38, 38, 0.1)",
    icon: <ExclamationCircleOutlined />,
  },
};

/** Polls the public notice endpoint so open sessions pick up changes without a reload. */
export function useSystemNotice(): { notice: ActiveSystemNotice | null; loaded: boolean } {
  const [notice, setNotice] = useState<ActiveSystemNotice | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Safety fallback: guarantee that UI unblocks within 1 second even under high latency
    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setLoaded(true);
    }, 1000);

    const load = async () => {
      try {
        const next = await fetchActiveSystemNotice();
        if (cancelled) return;
        setNotice(next);
      } finally {
        if (!cancelled) {
          clearTimeout(fallbackTimer);
          setLoaded(true);
        }
      }
    };

    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      clearInterval(interval);
    };
  }, []);

  return { notice, loaded };
}

/** Signs out whoever is logged in and opens the login form past the maintenance screen. */
function goToAdminLogin(): void {
  clearAuthSession();
  window.location.replace(ADMIN_LOGIN_PATH);
}

/** Full-page screen that replaces the portal while a maintenance notice is live. */
export const MaintenanceScreen = ({
  notice,
  onAdminSignIn = goToAdminLogin,
}: {
  notice: ActiveSystemNotice;
  onAdminSignIn?: () => void;
}) => {
  const style = NOTICE_STYLES[notice.type] ?? NOTICE_STYLES.warning;
  const updated = dayjs(notice.updatedAt);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f4f6f9] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,166,35,0.14),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/5 blur-3xl"
      />

      <div className="relative w-full max-w-[600px] animate-fade-in">
        <img
          src="/assets/Casagrand-Logo1.png"
          alt="Casagrand Logo"
          className="mx-auto mb-6 h-10 max-w-[220px] object-contain"
        />

        <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-[0_12px_48px_rgba(15,23,42,0.10)] backdrop-blur-sm">
          <div className="h-1.5 w-full" style={{ background: style.color }} />

          <div className="px-6 pb-8 pt-10 text-center sm:px-10">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full opacity-40 [animation-duration:2.5s]"
                style={{ background: style.tint }}
              />
              <span
                className="relative flex h-20 w-20 items-center justify-center rounded-full text-[34px]"
                style={{ background: style.tint, color: style.color }}
              >
                {style.icon}
              </span>
            </div>

            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ background: style.tint, color: style.color }}
            >
              {style.label}
            </span>

            <h1 className="mb-2 mt-4 text-2xl font-semibold text-[#0b1e36] sm:text-[28px]">
              We&apos;ll be back soon
            </h1>
            <p className="mb-6 text-sm text-gray-500">
              The Timesheet Portal is temporarily unavailable. Thanks for your patience.
            </p>

            <div
              className="rounded-xl border border-gray-100 bg-gray-50/80 px-5 py-4 text-left"
              style={{ borderLeft: `4px solid ${style.color}` }}
            >
              <p className="m-0 whitespace-pre-line break-words text-[15px] leading-relaxed text-gray-700">
                {notice.message}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                This page updates automatically
              </span>
              {updated.isValid() && <span>Updated {updated.format("DD MMM YYYY, h:mm A")}</span>}
            </div>
          </div>

          <div className="flex items-center justify-center border-t border-gray-100 bg-gray-50/60 px-6 py-3.5">
            <button
              type="button"
              onClick={onAdminSignIn}
              className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-sm text-gray-500 transition-colors hover:text-[#F5A623]"
            >
              <LockOutlined className="text-xs" />
              Administrator? Sign in
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">© 2026 Timesheet Portal</p>
      </div>
    </div>
  );
};

/** Slim reminder for the superadmin, who can still use the portal while the notice is live. */
export const SystemNoticeBanner = ({ notice }: { notice: ActiveSystemNotice }) => (
  <Alert
    type={notice.type}
    showIcon
    banner
    title={
      <span className="whitespace-pre-line">
        <strong>Maintenance screen is live for all users:</strong> {notice.message}
      </span>
    }
  />
);
