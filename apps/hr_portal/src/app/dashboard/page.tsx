"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Typography,
  DatePicker,
  Select,
  Button,
  Upload,
  message,
  Tag,
  Spin,
  Empty,
  Drawer,
  Table,
} from "antd";
import {
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  CalendarOutlined,
  BarChartOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { getTokenRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { API_BASE, apiFetch, getAuthHeaders } from "@/lib/api";
import {
  appendDepartmentFilter,
  DEFAULT_DEPARTMENT_FILTER,
  hasActiveDepartmentFilter,
  type DepartmentFilter,
  type DepartmentFilterOptions,
} from "@/lib/reportFilters";
import { AdminDepartmentFilter } from "@/components/reports/AdminDepartmentFilter";
import { FilterField } from "@/components/ui/FilterField";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { DepartmentUtilizationRow } from "@/components/dashboard/DepartmentUtilizationRow";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import {
  PERIOD_PRESET_OPTIONS,
  PeriodPreset,
  appendPeriodToSearchParams,
  getEffectiveDateRange,
} from "@/lib/dateRangePresets";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface DashboardSummary {
  totalEmployees: number;
  totalLoggedHours: number;
  avgUtilization: number;
  timesheetsSubmitted: number;
  departments: Array<{
    department: string;
    avgUtilization: number;
    totalHours: number;
    headcount: number;
  }>;
  filterOptions: DepartmentFilterOptions;
  totalSignUpUsers: number;
  signedUpUsersList?: Array<{
    employeeId: string;
    name: string;
    email: string;
    department: string;
  }>;
}

type DashboardCardFilter =
  | "all"
  | "with_hours"
  | "low_utilization"
  | "with_activity";

const DASHBOARD_CARD_FILTER_LABELS: Record<DashboardCardFilter, string> = {
  all: "All departments",
  with_hours: "Departments with logged hours",
  low_utilization: "Departments below 90% utilization",
  with_activity: "Departments with timesheet activity",
};

function filterDepartmentsByCard(
  departments: DashboardSummary["departments"],
  filter: DashboardCardFilter,
) {
  switch (filter) {
    case "with_hours":
    case "with_activity":
      return departments.filter((dept) => dept.totalHours > 0);
    case "low_utilization":
      return departments.filter((dept) => dept.avgUtilization < 90);
    default:
      return departments;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_week");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [adminFilters, setAdminFilters] = useState<DepartmentFilter>(
    DEFAULT_DEPARTMENT_FILTER,
  );
  const [filterOptions, setFilterOptions] = useState<DepartmentFilterOptions | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobErrors, setJobErrors] = useState<any[] | null>(null);
  const [jobSummary, setJobSummary] = useState<{
    totalRows?: number;
    successCount?: number;
    failureCount?: number;
  } | null>(null);
  const [cardFilter, setCardFilter] = useState<DashboardCardFilter>("all");
  const [isUserDrawerVisible, setIsUserDrawerVisible] = useState(false);

  const toggleCardFilter = (filter: DashboardCardFilter) => {
    setCardFilter((current) => (current === filter ? "all" : filter));
  };

  const dateRange = useMemo(() => {
    const [from, to] = getEffectiveDateRange(periodPreset, customRange);
    return {
      fromDate: from.format("YYYY-MM-DD"),
      toDate: to.format("YYYY-MM-DD"),
      label: `${from.format("MMM D")} – ${to.format("MMM D, YYYY")}`,
    };
  }, [periodPreset, customRange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = getTokenRole();
    if (role !== "admin") {
      router.replace("/timesheet");
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });
        appendDepartmentFilter(params, adminFilters);
        const data = await apiFetch<DashboardSummary>(
          `/api/reports/dashboard-summary?${params}`,
        );
        setSummary(data);
        setFilterOptions(data.filterOptions);
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : "Failed to load dashboard";
        messageApi.error(errMsg);
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
  }, [router, dateRange.fromDate, dateRange.toDate, adminFilters, messageApi]);

  const pollJobStatus = (id: string) => {
    setJobStatus("queued");
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/admin/bulk-upload/status/${id}`,
          {
            headers: getAuthHeaders(),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Status check failed");
        }

        const status = data.job?.status;
        setJobStatus(status);
        setJobErrors(data.job?.errors || null);
        setJobSummary({
          totalRows: data.job?.totalRows,
          successCount: data.job?.successCount ?? data.job?.addedCount,
          failureCount: data.job?.failureCount,
        });

        if (status === "completed" || status === "failed") {
          window.clearInterval(intervalId);
          if (status === "completed") {
            const successCount =
              data.job?.successCount ?? data.job?.addedCount ?? 0;
            const failureCount = data.job?.failureCount ?? 0;
            messageApi.success(
              `Upload completed: ${successCount} rows imported${failureCount > 0 ? `, ${failureCount} failed` : ""}.`,
            );
          } else {
            messageApi.error(
              `Upload failed: ${data.job.errorMessage || "See errors"}`,
            );
          }
        }
      } catch (error: unknown) {
        window.clearInterval(intervalId);
        messageApi.error(
          error instanceof Error ? error.message : "Upload status check failed.",
        );
      }
    }, 4000);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setJobId(null);
    setJobStatus(null);
    setJobErrors(null);
    setJobSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/admin/bulk-upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setJobId(data.jobId ?? null);
      setJobStatus("queued");
      messageApi.success("Upload queued. Tracking status...");
      if (data.jobId) {
        pollJobStatus(data.jobId);
      }
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : "Upload failed.");
    }
    setUploading(false);
  };

  const submissionRate = useMemo(() => {
    const total = summary?.totalEmployees ?? 0;
    const submitted = summary?.timesheetsSubmitted ?? 0;
    return total > 0 ? (submitted / total) * 100 : 0;
  }, [summary]);

  const filteredDepartments = useMemo(() => {
    const departments = summary?.departments ?? [];
    const filtered = filterDepartmentsByCard(departments, cardFilter);
    if (cardFilter === "with_hours") {
      return [...filtered].sort((a, b) => b.totalHours - a.totalHours);
    }
    if (cardFilter === "low_utilization") {
      return [...filtered].sort((a, b) => a.avgUtilization - b.avgUtilization);
    }
    return filtered;
  }, [summary?.departments, cardFilter]);

  const buildReportsUrl = (department: string) => {
    const params = new URLSearchParams();
    params.set("department", department);
    appendPeriodToSearchParams(params, periodPreset, customRange);
    return `/reports?${params}`;
  };

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {contextHolder}

      {/* Header */}
      <div className="flex flex-col gap-1 mb-4">
        <Title level={2} className="!mb-0 text-xl md:text-3xl">
          Admin Dashboard
        </Title>
        <Text className="text-gray-500">
          Organization utilization from employee master and timesheet data.
        </Text>
      </div>



      {/* Toolbar */}
      <Card
        variant="borderless"
        className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
        styles={{ body: { padding: 20 } }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4 flex-1">
              <FilterField label="Period" icon={<CalendarOutlined />} className="w-full sm:w-44">
                <Select
                  value={periodPreset}
                  onChange={(value: PeriodPreset) => {
                    if (value === "custom") {
                      setCustomRange(getEffectiveDateRange(periodPreset, customRange));
                    } else {
                      setCustomRange(null);
                    }
                    setPeriodPreset(value);
                  }}
                  className="w-full"
                  options={PERIOD_PRESET_OPTIONS}
                />
              </FilterField>

              <FilterField label="Date Range" className="w-full sm:w-auto">
                <RangePicker
                  className="w-full"
                  value={getEffectiveDateRange(periodPreset, customRange)}
                  onChange={(dates) => {
                    if (dates?.[0] && dates?.[1]) {
                      setPeriodPreset("custom");
                      setCustomRange([dates[0], dates[1]]);
                    } else {
                      setCustomRange(null);
                      setPeriodPreset("this_week");
                    }
                  }}
                  disabledDate={(current) => current && current > dayjs().endOf("day")}
                  disabled={periodPreset !== "custom"}
                />
              </FilterField>

              <AdminDepartmentFilter
                value={adminFilters}
                options={filterOptions}
                loading={!filterOptions && loading}
                onChange={setAdminFilters}
                showLabel
                className="w-full sm:w-56"
              />
            </div>

            <Upload
              accept=".csv,.xlsx,.xls"
              beforeUpload={(file) => {
                void handleUpload(file);
                return false;
              }}
              showUploadList={false}
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
                className="w-full sm:w-auto"
              >
                Bulk Upload
              </Button>
            </Upload>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
            <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-gray-200 !bg-gray-50 !text-gray-600">
              {dateRange.label}
            </Tag>
            {hasActiveDepartmentFilter(adminFilters) && (
              <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-[#F5A623]/30 !bg-[#F5A623]/10 !text-[#c4841a]">
                {adminFilters.department}
              </Tag>
            )}
            {loading && summary && (
              <span className="text-xs text-gray-400 flex items-center gap-1.5 ml-auto">
                <Spin size="small" />
                Refreshing…
              </span>
            )}
          </div>

          {jobStatus && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 dark:bg-zinc-900 px-4 py-3">
              <span className="text-sm text-gray-500">Upload status:</span>
              <Tag
                color={
                  jobStatus === "completed"
                    ? "success"
                    : jobStatus === "failed"
                      ? "error"
                      : "processing"
                }
              >
                {jobStatus.toUpperCase()}
              </Tag>
              {jobId && (
                <span className="text-sm text-gray-500">Job ID: {jobId}</span>
              )}
              {jobSummary?.totalRows !== undefined && (
                <span className="text-sm text-gray-500">
                  Processed: {jobSummary.totalRows} | Success:{" "}
                  {jobSummary.successCount ?? 0} | Failed:{" "}
                  {jobSummary.failureCount ?? 0}
                </span>
              )}
            </div>
          )}
          {jobErrors && jobErrors.length > 0 && (
            <div className="text-sm text-orange-600 px-1">
              {jobErrors.length} rows could not be imported.
            </div>
          )}
        </div>
      </Card>

      {/* Summary metrics */}
      <div className="relative">
        {loading && summary && (
          <div className="absolute inset-0 z-10 rounded-xl bg-white/40 dark:bg-black/20 pointer-events-none" />
        )}
        <div className="flex items-center justify-between mb-3">
          <Title level={5} className="mt-3 !mb-0 text-gray-700 dark:text-gray-200">
            Organization Summary
          </Title>
        </div>
        <Row gutter={[{ xs: 8, sm: 12, md: 16 }, { xs: 8, sm: 12, md: 16 }]}>
          <Col xs={12} sm={12} lg={4}>
            <DashboardMetricCard
              title="Total Employees"
              valueLabel={(summary?.totalEmployees ?? 0).toLocaleString()}
              icon={<TeamOutlined />}
              iconClassName="bg-blue-50 text-blue-500"
              barClassName="bg-blue-500"
            />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <DashboardMetricCard
              title="Total App Users"
              valueLabel={(summary?.totalSignUpUsers ?? 0).toLocaleString()}
              icon={<TeamOutlined />}
              iconClassName="bg-purple-50 text-purple-500"
              barClassName="bg-purple-500"
              onClick={() => setIsUserDrawerVisible(true)}
              active={false}
            />
          </Col>
          <Col xs={12} sm={12} lg={5}>
            <DashboardMetricCard
              title="Total Logged Hours"
              valueLabel={String(summary?.totalLoggedHours ?? 0)}
              targetLabel="hrs"
              percent={Math.min((summary?.totalLoggedHours ?? 0) > 0 ? 100 : 0, 100)}
              footerLeft="Selected period"
              footerRight={`${summary?.totalLoggedHours ?? 0}h total`}
              icon={<ClockCircleOutlined />}
              iconClassName="bg-indigo-50 text-indigo-500"
              barClassName="bg-indigo-500"
              onClick={() => toggleCardFilter("with_hours")}
              active={cardFilter === "with_hours"}
            />
          </Col>
          <Col xs={12} sm={12} lg={5}>
            <DashboardMetricCard
              title="Avg. Utilization"
              valueLabel={String(summary?.avgUtilization ?? 0)}
              targetLabel="%"
              percent={Math.min(summary?.avgUtilization ?? 0, 100)}
              footerLeft={
                (summary?.avgUtilization ?? 0) >= 90 ? "On track" : "Needs attention"
              }
              footerRight={`${summary?.avgUtilization ?? 0}%`}
              icon={<CheckCircleOutlined />}
              iconClassName="bg-green-50 text-green-500"
              barClassName={
                (summary?.avgUtilization ?? 0) >= 90 ? "bg-green-500" : "bg-amber-500"
              }
              valueClassName={
                (summary?.avgUtilization ?? 0) >= 90
                  ? "text-green-600"
                  : "text-amber-600"
              }
              onClick={() => toggleCardFilter("low_utilization")}
              active={cardFilter === "low_utilization"}
            />
          </Col>
          <Col xs={24} sm={24} lg={6}>
            <DashboardMetricCard
              title="Timesheets Submitted"
              valueLabel={String(summary?.timesheetsSubmitted ?? 0)}
              targetLabel={`/ ${(summary?.totalEmployees ?? 0).toLocaleString()}`}
              percent={submissionRate}
              footerLeft="Submission rate"
              footerRight={`${Math.round(submissionRate)}%`}
              icon={<CheckCircleOutlined />}
              iconClassName="bg-amber-50 text-[#F5A623]"
              barClassName="bg-[#F5A623]"
              valueClassName="text-[#F5A623]"
              onClick={() => toggleCardFilter("with_activity")}
              active={cardFilter === "with_activity"}
            />
          </Col>
        </Row>
      </div>

      {/* Department utilization */}
      <Card
        variant="borderless"
        className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
        styles={{ body: { padding: 20 } }}
        title={
          <span className="flex items-center gap-2 text-base font-semibold">
            <BarChartOutlined className="text-[#F5A623]" />
            Department Utilization
          </span>
        }
        extra={
          <div className="flex items-center gap-3">
            {cardFilter !== "all" && (
              <button
                type="button"
                onClick={() => setCardFilter("all")}
                className="text-sm text-[#F5A623] hover:underline"
              >
                Clear filter
              </button>
            )}
            <Text className="text-xs text-gray-400 hidden sm:inline">
              Click a department to view reports →
            </Text>
          </div>
        }
      >
        {cardFilter !== "all" && (
          <div className="mb-4">
            <Tag className="!m-0 !rounded-full !px-3 !py-0.5 !border-[#F5A623]/30 !bg-[#F5A623]/10 !text-[#c4841a]">
              {DASHBOARD_CARD_FILTER_LABELS[cardFilter]} ({filteredDepartments.length})
            </Tag>
          </div>
        )}
        {filteredDepartments.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredDepartments.map((dept) => (
              <DepartmentUtilizationRow
                key={dept.department}
                department={dept.department}
                avgUtilization={dept.avgUtilization}
                headcount={dept.headcount}
                totalHours={dept.totalHours}
                onClick={() => router.push(buildReportsUrl(dept.department))}
              />
            ))}
          </div>
        ) : (
          <Empty
            description={
              cardFilter === "all"
                ? "No department utilization data for the selected period."
                : `No departments match "${DASHBOARD_CARD_FILTER_LABELS[cardFilter]}".`
            }
          />
        )}
      </Card>


      <Drawer
        title="Signed Up Users"
        open={isUserDrawerVisible}
        onClose={() => setIsUserDrawerVisible(false)}
        size="large"
      >
        <ResponsiveTable
          dataSource={summary?.signedUpUsersList ?? []}
          rowKey="email"
          pagination={{ pageSize: 15 }}
          columns={[
            { title: "S.No", key: "sno", width: 60, render: (_: any, __: any, index: number) => index + 1 },
            { title: "Emp ID", dataIndex: "employeeId", key: "employeeId", width: 100 },
            { title: "Name", dataIndex: "name", key: "name" },
            { title: "Email", dataIndex: "email", key: "email" },
            { title: "Department", dataIndex: "department", key: "department" },
          ]}
        />
      </Drawer>
    </div>
  );
}
