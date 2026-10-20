"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClockCircleOutlined,
  CloseOutlined,
  CustomerServiceOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

export const SUPPORT_PHONE = "+91 90439 95078";
export const SUPPORT_EMAIL = "sasitharan.nr@casagrand.co.in";
export const SUPPORT_HOURS = "Monday to Saturday, 9:30 AM – 6:30 PM";

/** Floating help button with a quick-contact panel; links to the full /support page. */
export const SupportWidget = ({ pathname }: { pathname: string }) => {
  const [open, setOpen] = useState(false);

  // Close the panel when the user navigates elsewhere.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Help & Support"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[340px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 bg-[#111827] text-white">
            <span className="text-base font-bold">Help & Support</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white cursor-pointer bg-transparent border-0 p-1"
            >
              <CloseOutlined />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <p className="text-gray-600 dark:text-gray-300 mb-1">Need assistance? We&apos;re here to help.</p>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-zinc-700">
              <div className="w-9 h-9 rounded-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                <PhoneOutlined className="text-[#F5A623]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Phone</p>
                <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`} className="text-blue-600 font-medium">
                  {SUPPORT_PHONE}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-zinc-700">
              <div className="w-9 h-9 rounded-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                <MailOutlined className="text-[#F5A623]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Email</p>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 font-medium break-all">
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-medium">
              <ClockCircleOutlined className="mt-0.5" />
              <span>Support Hours: Mon–Sat, 9:30 AM – 6:30 PM</span>
            </div>

            <Link
              href="/support"
              className="block text-center py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-[#F5A623]/50 !text-[#b4730f] font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              View Full Support Guide
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close help & support" : "Help & Support"}
        title="Help & Support"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-[#F5A623] hover:bg-[#e0951a] text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer border-0"
      >
        {open ? <CloseOutlined className="text-xl" /> : <CustomerServiceOutlined className="text-2xl" />}
      </button>
    </>
  );
};
