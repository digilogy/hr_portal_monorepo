"use client";

import React, { useEffect, useState } from "react";
import { ProfileHeader } from "@/components/ui/ProfileHeader";
import { Typography, Divider, Spin } from "antd";
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
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="max-w-7xl mx-auto pb-32 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-500 mt-2">Manage your personal information and preferences.</p>
        {profile && (
          <p className="text-sm text-[#F5A623] font-semibold mt-1">
            {getProfileDisplayTitle(profile.jobTitle, profile.role)}
          </p>
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

            <div
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
            </div>

            <Divider className="my-6" />

            <div className="space-y-4">
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
    </div>
  );
}
