"use client";

import React from "react";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE } from "@/components/layout/SupportWidget";

const HELP_AREAS = [
  "Trouble logging in or accessing your account",
  "Issues while filling or editing your timesheet",
  "Clarification on shift timings, holidays, or working days",
  "Questions about reports, team timesheets, or approvals",
  "Technical issues (upload errors, page not loading, etc.)",
];

export default function SupportPage() {
  return (
    <div className="max-w-7xl mx-auto pb-16 pt-2 px-0 sm:px-2 font-sans">
      <div className="max-w-4xl mx-auto bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 sm:p-10">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-snug">
          Need assistance with <span className="text-[#F5A623]">timesheets</span> or have questions
          about the process?
        </h1>
        <p className="text-gray-500 mt-3">We&apos;re here to help.</p>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-8 mb-2">Get in Touch</h2>
        <p className="text-gray-500 mb-5">
          Reach out if you need help logging hours, updating your shift timing, viewing reports, or
          navigating the portal.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <PhoneOutlined className="text-[#F5A623] text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Phone</p>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`} className="text-blue-600 font-medium">
                {SUPPORT_PHONE}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <MailOutlined className="text-[#F5A623] text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 font-medium break-all">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 mt-6">
          <ClockCircleOutlined className="text-[#F5A623] text-xl mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Support Hours</p>
            <p className="text-gray-500">{SUPPORT_HOURS}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-8 mb-4">
          Common Areas We Can Help With
        </h2>
        <ul className="space-y-3">
          {HELP_AREAS.map((area) => (
            <li key={area} className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
              <CheckCircleFilled className="text-green-600 mt-1" />
              <span>{area}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 mt-8 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300">
          <QuestionCircleOutlined className="text-[#F5A623]" />
          <span>We aim to respond to all queries within 24–48 business hours.</span>
        </div>
      </div>
    </div>
  );
}
