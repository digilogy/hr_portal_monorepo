import React from 'react';
import { UserOutlined, IdcardOutlined, TeamOutlined, ApartmentOutlined, SolutionOutlined } from '@ant-design/icons';
import { getDisplayFirstName } from '@/lib/auth';

interface ProfileHeaderProps {
  name: string;
  employeeId: string;
  reportingManager: string;
  hod: string;
  department: string;
  subDepartment: string;
  employmentStatus?: string;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  employeeId,
  reportingManager,
  hod,
  department,
  subDepartment,
  employmentStatus = "Active",
}) => {
  const isActive = employmentStatus.toLowerCase() === "active";
  const displayName = name === "—" ? "Employee" : name;

  return (
    <div className="relative bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm mb-8 flex flex-col md:flex-row items-center gap-8">

      {/* Avatar Section */}
      <div className="relative flex-shrink-0">
        <div className="w-24 h-24 rounded-full border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-zinc-900">
          <UserOutlined className="text-3xl text-gray-400 dark:text-gray-500" />
        </div>
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border-2 border-white dark:border-black uppercase tracking-wider ${isActive ? "bg-green-500" : "bg-gray-400"}`}>
          {employmentStatus}
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-1 w-full text-center md:text-left">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
          Welcome back, {getDisplayFirstName(displayName)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center justify-center md:justify-start gap-2">
          <IdcardOutlined className="text-gray-400" /> {employeeId}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5 border-t border-gray-100 dark:border-zinc-800">

          <div className="flex flex-col items-center md:items-start">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <TeamOutlined className="text-gray-400" /> Manager
            </span>
            <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">{reportingManager}</span>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <SolutionOutlined className="text-gray-400" /> HOD
            </span>
            <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">{hod}</span>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <ApartmentOutlined className="text-gray-400" /> Department
            </span>
            <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">{department}</span>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <ApartmentOutlined className="text-gray-400" /> Sub Department
            </span>
            <span className="text-gray-800 dark:text-gray-200 font-medium text-sm">{subDepartment}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
