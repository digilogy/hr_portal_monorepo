"use client";

import React, { useState, useMemo } from "react";
import { Segmented, Tag, Button, Modal, Input, Table } from "antd";
import { UnorderedListOutlined, SearchOutlined } from "@ant-design/icons";

export interface DepartmentUtilizationItem {
  department: string;
  totalHours: number;
  headcount: number;
  avgUtilization: number;
}

interface UtilizationByDepartmentProps {
  departments?: DepartmentUtilizationItem[];
  totalDepartments?: number;
  activeDepartments?: number;
}

const BAR_COLORS = [
  "#F5A623", // Amber / Orange
  "#3B82F6", // Blue
  "#10B981", // Emerald / Teal
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F97316", // Deep Orange
  "#06B6D4", // Cyan
];

export function UtilizationByDepartment({
  departments = [],
  totalDepartments,
  activeDepartments,
}: UtilizationByDepartmentProps) {
  const [filterMode, setFilterMode] = useState<"top5" | "lowest5">("top5");
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const actualTotal = totalDepartments ?? departments.length;
  const actualActive =
    activeDepartments ??
    departments.filter((d) => d.avgUtilization > 0 || d.totalHours > 0).length;

  const sortedDepartments = useMemo(() => {
    return [...departments].sort(
      (a, b) => b.avgUtilization - a.avgUtilization || b.totalHours - a.totalHours,
    );
  }, [departments]);

  const top5Departments = useMemo(() => {
    return sortedDepartments
      .filter((d) => d.avgUtilization > 0 || d.totalHours > 0)
      .slice(0, 5);
  }, [sortedDepartments]);

  const displayedDepartments = useMemo(() => {
    if (filterMode === "top5") {
      return top5Departments;
    } else {
      const top5Names = new Set(top5Departments.map((d) => d.department));
      return [...departments]
        .filter((d) => !top5Names.has(d.department))
        .sort(
          (a, b) => a.avgUtilization - b.avgUtilization || a.totalHours - b.totalHours,
        )
        .slice(0, 5);
    }
  }, [top5Departments, departments, filterMode]);

  const filteredModalData = useMemo(() => {
    if (!searchQuery.trim()) return sortedDepartments;
    const query = searchQuery.toLowerCase().trim();
    return sortedDepartments.filter((d) =>
      d.department.toLowerCase().includes(query),
    );
  }, [sortedDepartments, searchQuery]);

  const columns = [
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      render: (text: string) => <span className="font-semibold">{text}</span>,
    },
    {
      title: "Headcount",
      dataIndex: "headcount",
      key: "headcount",
      align: "center" as const,
    },
    {
      title: "Total Logged Hours",
      dataIndex: "totalHours",
      key: "totalHours",
      align: "right" as const,
      render: (val: number) => `${val}h`,
    },
    {
      title: "Avg. Utilization (%)",
      dataIndex: "avgUtilization",
      key: "avgUtilization",
      align: "right" as const,
      render: (val: number) => (
        <span
          className={`font-bold ${
            val >= 90
              ? "text-emerald-600"
              : val >= 70
              ? "text-amber-600"
              : "text-red-500"
          }`}
        >
          {val.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-950 p-4 sm:p-4.5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">
              Utilization by Department
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Ranked avg utilization % across {actualTotal} departments.
            </p>
          </div>
          <Button
            size="small"
            type="text"
            icon={<UnorderedListOutlined />}
            onClick={() => setModalOpen(true)}
            className="text-xs text-gray-600 dark:text-zinc-300 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0"
          >
            All ({actualTotal})
          </Button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Segmented
            size="small"
            value={filterMode}
            onChange={(val) => setFilterMode(val as "top5" | "lowest5")}
            options={[
              { label: "Top 5", value: "top5" },
              { label: "Lowest 5", value: "lowest5" },
            ]}
            className="text-[11px] font-medium"
          />
          <Tag className="!m-0 !rounded-full !px-2.5 !py-0.5 !border-amber-200 !bg-amber-50 dark:!bg-amber-950/40 dark:!border-amber-800 !text-amber-600 dark:!text-amber-400 font-semibold text-[10px]">
            {actualActive} Active
          </Tag>
        </div>

        {/* Progress Bars List */}
        {displayedDepartments.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            {filterMode === "top5"
              ? "No active department utilization (> 0%) recorded for this period."
              : "All active departments fit within the Top 5 view."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedDepartments.map((dept, index) => {
              const color = BAR_COLORS[index % BAR_COLORS.length];
              const pct = Math.min(100, Math.max(0, dept.avgUtilization));

              return (
                <div key={dept.department || index}>
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-1">
                    <span className="truncate pr-2">{dept.department}</span>
                    <span className="shrink-0">{dept.avgUtilization.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Axis Scale at Bottom */}
      <div className="border-t border-gray-100 dark:border-zinc-800/80 pt-2 mt-3">
        <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>

      {/* All Departments Modal */}
      <Modal
        title={`Utilization by Department (${actualTotal})`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <div className="py-3">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
            allowClear
          />
          <Table
            dataSource={filteredModalData}
            columns={columns}
            rowKey="department"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            size="small"
          />
        </div>
      </Modal>
    </div>
  );
}
