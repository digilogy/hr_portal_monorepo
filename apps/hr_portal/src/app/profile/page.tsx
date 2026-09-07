"use client";

import React, { useEffect, useState } from "react";
import { ProfileHeader } from "@/components/ui/ProfileHeader";
import { Typography, Divider, Spin, Select } from "antd";
import { MailOutlined, PhoneOutlined, PushpinOutlined } from "@ant-design/icons";
import { apiFetch } from "@/lib/api";
import { getProfileDisplayTitle, type UserRole } from "@/lib/auth";

const { Text } = Typography;

interface EmployeeProfile {
  name: string;
  employeeId: string;
  reportingManager: string;
  hod: string;
  department: string;
  email: string;
  phone: string;
  jobTitle: string;
  employmentStatus: string;
  subDepartment: string;
  role: UserRole;
  shiftName?: string;
  allowedTimings?: string;
  preferredTiming?: string;
  mappedZone?: string;
  upcomingHolidays?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    isOptional: boolean;
  }>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTiming, setSavingTiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ profile: EmployeeProfile }>("/api/profile/me");
        setProfile(data.profile);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load profile";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-7xl mx-auto pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500 mt-2">Manage your personal information and preferences.</p>
        </div>
        <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-8 text-center">
          <Text type="danger">{error || "Profile not found"}</Text>
          <p className="text-gray-500 mt-2 text-sm">
            Your account email must match an employee record in the master data.
          </p>
        </div>
      </div>
    );
  }

  const isActive = profile.employmentStatus.toLowerCase() === "active";
  const shiftOptions = profile.allowedTimings
    ? profile.allowedTimings.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const handleUpdateTiming = async (val: string) => {
    setSavingTiming(true);
    try {
      await apiFetch("/api/profile/me/preferred-timing", {
        method: "PUT",
        body: JSON.stringify({ preferredTiming: val }),
      });
      setProfile((prev) => prev ? { ...prev, preferredTiming: val } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTiming(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500 mt-2">Manage your personal information and preferences.</p>
          {profile && (
            <p className="text-sm text-[#F5A623] font-semibold mt-1">
              {getProfileDisplayTitle(profile.jobTitle, profile.role)}
            </p>
          )}
        </div>

        {shiftOptions.length > 1 && (
          <div className="w-full sm:w-auto bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800/50">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">My Shift Timing</p>
            <Select
              value={profile.preferredTiming || undefined}
              placeholder="Select a shift timing"
              onChange={(val) => handleUpdateTiming(val)}
              disabled={savingTiming}
              placement="bottomRight"
              className="w-full sm:w-[220px]"
              size="large"
            >
              {shiftOptions.map((opt) => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <ProfileHeader
        name={profile.name}
        employeeId={profile.employeeId}
        reportingManager={profile.reportingManager}
        hod={profile.hod}
        department={profile.department}
        subDepartment={profile.subDepartment}
        employmentStatus={profile.employmentStatus}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2">
          <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-8 h-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Contact Information
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <MailOutlined className="text-[#F5A623] text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email Address
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium break-all">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <PhoneOutlined className="text-[#F5A623] text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Phone Number
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">{profile.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                  <PushpinOutlined className="text-[#F5A623] text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Department
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium break-words">
                    {profile.department}
                    {profile.subDepartment !== "—" ? ` · ${profile.subDepartment}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1">
          <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-8 h-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Account Status</h2>

            {/* <div
              className={`border rounded-2xl p-4 mb-6 ${isActive
                  ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                  : "bg-gray-50 dark:bg-zinc-900/10 border-gray-200 dark:border-zinc-700"
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                />
                <span
                  className={`font-semibold ${isActive ? "text-green-700 dark:text-green-400" : "text-gray-600"}`}
                >
                  {profile.employmentStatus}
                </span>
              </div>
            </div> */}

            <Divider className="my-6" />

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Shift</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">{profile.shiftName || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Job Title</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">{profile.jobTitle}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Employee ID</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">{profile.employeeId}</p>
              </div>
            </div>



            {/* <button className="w-full mt-8 py-3 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors">
              Request Info Update
            </button> */}
          </div>
        </div>
      </div>

      {/* Public Holidays Section */}
      {profile.mappedZone && profile.upcomingHolidays && (
        <div className="mt-6 bg-white dark:bg-black rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Public Holidays</h2>
            <div className="mt-2 sm:mt-0 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 text-[#F5A623] rounded-full text-sm font-semibold border border-orange-100 dark:border-orange-900/30">
              {profile.mappedZone}
            </div>
          </div>
          
          {profile.upcomingHolidays.length === 0 ? (
            <p className="text-gray-500">No holidays scheduled for your zone.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800">
                    <th className="pb-3 text-sm font-semibold text-gray-500">Holiday</th>
                    <th className="pb-3 text-sm font-semibold text-gray-500">Date</th>
                    <th className="pb-3 text-sm font-semibold text-gray-500">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {profile.upcomingHolidays.map((holiday, idx) => {
                    const start = new Date(holiday.startDate);
                    const end = new Date(holiday.endDate);
                    const dateStr = start.getTime() === end.getTime() 
                      ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
                      : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}`;
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="py-4 text-gray-900 dark:text-gray-100 font-medium">
                          {holiday.name}
                        </td>
                        <td className="py-4 text-gray-600 dark:text-gray-400">
                          {dateStr}
                        </td>
                        <td className="py-4">
                          {holiday.isOptional ? (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium">Optional</span>
                          ) : (
                            <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-xs font-medium border border-green-100 dark:border-green-900/30">Mandatory</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
