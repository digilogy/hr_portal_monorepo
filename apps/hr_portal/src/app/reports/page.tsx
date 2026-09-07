"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  DatePicker,
  Button,
  Tabs,
  Table,
  Space,
  Tag,
  Avatar,
  Alert,
  Empty,
  message,
  Modal,
  Spin,
  Select,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  FileExcelOutlined,
  FilterOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { apiFetch, downloadFile } from "@/lib/api";
import { canAccessReports, getNameInitials, getTokenRole } from "@/lib/auth";
import {
  appendReportFilters,
  DEFAULT_REPORT_FILTERS,
  hasActiveReportFilters,
  parseReportFiltersFromSearchParams,
  reportFiltersToSearchParams,
  sanitizeReportFilters,
  type ReportFilterOptions,
  type ReportFilters,
} from "@/lib/reportFilters";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import {
  PERIOD_PRESET_OPTIONS,
  PeriodPreset,
  appendPeriodToSearchParams,
  getEffectiveDateRange,
  parsePeriodFromSearchParams,
} from "@/lib/dateRangePresets";

const { Title } = Typography;
const { RangePicker } = DatePicker;

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
  if (h > 0) return `${h}hrs`;
  if (m > 0) return `${m}mins`;
  return "0hrs";
}

interface UserReportRow {
  key: string;
  empId: string;
  name: string;
  department: string;
  manager: string;
  hours: number;
  utilization: number;
  status: "Submitted" | "Pending";
}

interface EmployeeTimesheetDetail {
  employee: {
    empId: string;
    name: string;
    department: string;
    manager: string;
    email: string;
  };
  summary: {
    totalHours: number;
    expectedHours: number;
    utilization: number;
    status: "Submitted" | "Pending";
  };
  days: Array<{
    date: string;
    totalHours: number;
    tasks: Array<{ timeSlot: string; title: string; task: string; taskType: string }>;
  }>;
}

interface TimesheetTableRow {
  key: string;
  date: string;
  timeSlot: string;
  title: string;
  description: string;
  hours: number | null;
}

function getTaskDisplayTitle(task: { title: string; taskType: string }): string {
  if (task.taskType === "Custom" && task.title) return task.title;
  if (task.taskType && task.taskType !== "—") return task.taskType;
  return task.title || "—";
}

function calculateSlotHours(timeSlot: string): number | null {
  if (!timeSlot || timeSlot === "—") return null;
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return null;

  const parseTime = (timeStr: string) => {
    const [time, period] = timeStr.trim().split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h + m / 60;
  };

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  let diff = end - start;
  if (diff < 0) diff += 24;
  return parseFloat(diff.toFixed(1));
}

const timesheetColumns: ColumnsType<TimesheetTableRow> = [
  {
    title: "Date",
    dataIndex: "date",
    key: "date",
    width: 120,
    render: (date: string) => dayjs(date).format("MMM D, YYYY"),
  },
  { title: "Time Slot", dataIndex: "timeSlot", key: "timeSlot", width: 130 },
  { title: "Title", dataIndex: "title", key: "title", width: 140 },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    render: (text: string) => (
      <span className="whitespace-normal break-words leading-relaxed">{text}</span>
    ),
    onCell: () => ({
      style: { whiteSpace: "normal", wordBreak: "break-word", verticalAlign: "top" },
    }),
  },
  {
    title: "Hours",
    dataIndex: "hours",
    key: "hours",
    width: 72,
    align: "center",
    render: (val: number | null) => (val != null ? formatDuration(val) : "—"),
  },
];

const managerColumns: ColumnsType<any> = [
  {
    title: "Manager Name",
    dataIndex: "managerName",
    key: "managerName",
    render: (text: string) => (
      <Space>
        <Avatar icon={<UserOutlined />} />
        <span className="font-medium">{text}</span>
      </Space>
    ),
  },
  { title: "Department", dataIndex: "department", key: "department" },
  { title: "Team Size", dataIndex: "teamSize", key: "teamSize" },
  {
    title: "Total Logged Hours",
    dataIndex: "totalHours",
    key: "totalHours",
    render: (val: number) => <span className="font-semibold">{formatDuration(val)}</span>,
  },
  {
    title: "Avg. Utilization",
    dataIndex: "avgUtilization",
    key: "avgUtilization",
    render: (val: number) => (
      <span className={val > 100 ? "text-orange-500" : "text-green-600"}>{val}%</span>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (val: string) => (
      <Tag color={val === "On Track" ? "blue" : val === "Overutilized" ? "red" : "orange"}>
        {val}
      </Tag>
    ),
  },
];

const deptColumns: ColumnsType<any> = [
  { title: "Department", dataIndex: "department", key: "department", className: "font-medium" },
  { title: "HOD", dataIndex: "hod", key: "hod" },
  { title: "Headcount", dataIndex: "headcount", key: "headcount" },
  {
    title: "Total Logged Hours",
    dataIndex: "totalHours",
    key: "totalHours",
    render: (val: number) => <span className="font-semibold">{formatDuration(val)}</span>,
  },
  {
    title: "Avg. Utilization",
    dataIndex: "avgUtilization",
    key: "avgUtilization",
    render: (val: number) => (
      <span className={val > 100 ? "text-orange-500" : "text-green-600"}>{val}%</span>
    ),
  },
];

const orgColumns: ColumnsType<any> = [
  { title: "Period", dataIndex: "period", key: "period", className: "font-medium" },
  { title: "Headcount", dataIndex: "headcount", key: "headcount" },
  {
    title: "Expected Hours",
    dataIndex: "expectedHours",
    key: "expectedHours",
    render: (val: number) => <span className="text-gray-500">{formatDuration(val)}</span>,
  },
  {
    title: "Logged Hours",
    dataIndex: "loggedHours",
    key: "loggedHours",
    render: (val: number) => <span className="font-semibold">{formatDuration(val)}</span>,
  },
  {
    title: "Utilization",
    dataIndex: "utilization",
    key: "utilization",
    render: (val: number) => (
      <span className={val >= 100 ? "text-green-600" : "text-orange-500 font-medium"}>
        {val}%
      </span>
    ),
  },
];

interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

function ReportTable({
  columns,
  data,
  loading,
  pagination,
  scrollX,
  emptyText,
  cardRender,
}: {
  columns: ColumnsType<any>;
  data: any[];
  loading?: boolean;
  pagination: TablePaginationConfig;
  scrollX: number;
  emptyText: string;
  cardRender?: (record: any, index: number) => React.ReactNode;
}) {
  if (!loading && data.length === 0) {
    return <Empty description={emptyText} />;
  }

  return (
    <ResponsiveTable
      rowKey="key"
      columns={columns}
      dataSource={data}
      loading={loading}
      cardRender={cardRender}
      pagination={{
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50", "100"],
        ...pagination,
      }}
      scroll={{ x: scrollX }}
      className="[&_.ant-table-thead>tr>th]:bg-gray-50 dark:[&_.ant-table-thead>tr>th]:bg-zinc-900 [&_.ant-table-thead>tr>th]:font-semibold"
    />
  );
}

interface ReportCapabilities {
  userWise: boolean;
  managerWise: boolean;
  departmentWise: boolean;
  organizationWise: boolean;
}

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = getTokenRole();
  const isAdmin = role === "admin";
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("user");
  const [capabilities, setCapabilities] = useState<ReportCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const initialPeriod = parsePeriodFromSearchParams(searchParams);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(
    initialPeriod.periodPreset,
  );
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    initialPeriod.customRange,
  );

  const dateRange = useMemo(
    () => getEffectiveDateRange(periodPreset, customRange),
    [periodPreset, customRange],
  );

  const [userWiseData, setUserWiseData] = useState<any[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [userLoading, setUserLoading] = useState(true);

  const [managerWiseData, setManagerWiseData] = useState<any[]>([]);
  const [deptWiseData, setDeptWiseData] = useState<any[]>([]);
  const [orgWiseData, setOrgWiseData] = useState<any[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [managerPage, setManagerPage] = useState(1);
  const [managerPageSize, setManagerPageSize] = useState(10);
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(10);
  const [orgPage, setOrgPage] = useState(1);
  const [orgPageSize, setOrgPageSize] = useState(10);

  const [selectedEmployee, setSelectedEmployee] = useState<UserReportRow | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeTimesheetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [adminFilters, setAdminFilters] = useState<ReportFilters>(() =>
    parseReportFiltersFromSearchParams(searchParams),
  );
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(
    null,
  );
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  const syncReportsUrl = useCallback(
    (
      filters: ReportFilters,
      preset: PeriodPreset,
      range: [dayjs.Dayjs, dayjs.Dayjs] | null,
    ) => {
      const params = reportFiltersToSearchParams(filters);
      appendPeriodToSearchParams(params, preset, range);
      const query = params.toString();
      router.replace(query ? `/reports?${query}` : "/reports", { scroll: false });
    },
    [router],
  );

  const handleAdminFiltersChange = useCallback(
    (filters: ReportFilters) => {
      setAdminFilters(filters);
      syncReportsUrl(filters, periodPreset, customRange);
    },
    [syncReportsUrl, periodPreset, customRange],
  );

  useEffect(() => {
    if (!isAdmin) return;
    const parsed = parseReportFiltersFromSearchParams(searchParams);
    if (filterOptions?.employees?.length) {
      setAdminFilters(sanitizeReportFilters(parsed, filterOptions.employees));
    } else {
      setAdminFilters(parsed);
    }

    const parsedPeriod = parsePeriodFromSearchParams(searchParams);
    setPeriodPreset(parsedPeriod.periodPreset);
    setCustomRange(parsedPeriod.customRange);
  }, [searchParams, isAdmin, filterOptions]);

  const dateParams = useCallback(
    () => {
      const params = new URLSearchParams({
        fromDate: dateRange[0].format("YYYY-MM-DD"),
        toDate: dateRange[1].format("YYYY-MM-DD"),
      });
      if (isAdmin) {
        appendReportFilters(params, adminFilters);
      }
      return params;
    },
    [dateRange, isAdmin, adminFilters],
  );

  useEffect(() => {
    if (!canAccessReports(role)) {
      router.replace("/timesheet");
    }
  }, [router, role]);

  useEffect(() => {
    if (!canAccessReports(role)) return;

    const loadCapabilities = async () => {
      setCapabilitiesLoading(true);
      try {
        const data = await apiFetch<ReportCapabilities>("/api/reports/capabilities");
        setCapabilities(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load report access");
      } finally {
        setCapabilitiesLoading(false);
      }
    };

    void loadCapabilities();
  }, [role]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadFilterOptions = async () => {
      setFilterOptionsLoading(true);
      try {
        const options = await apiFetch<ReportFilterOptions>(
          "/api/reports/filter-options",
        );
        setFilterOptions(options);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to load filter options",
        );
      } finally {
        setFilterOptionsLoading(false);
      }
    };

    void loadFilterOptions();
  }, [isAdmin]);

  useEffect(() => {
    if (!capabilities) return;
    if (!capabilities.userWise) {
      router.replace("/timesheet");
      return;
    }
    if (activeTab === "manager" && !capabilities.managerWise) {
      setActiveTab("user");
    }
    if (activeTab === "dept" && !capabilities.departmentWise) {
      setActiveTab("user");
    }
    if (activeTab === "org" && !capabilities.organizationWise) {
      setActiveTab("user");
    }
  }, [capabilities, activeTab, router]);

  useEffect(() => {
    if (!canAccessReports(role) || !capabilities?.userWise) return;

    const loadUserReport = async () => {
      setUserLoading(true);
      setError(null);
      try {
        const params = dateParams();
        params.set("page", String(userPage));
        params.set("pageSize", String(userPageSize));
        const response = await apiFetch<PaginatedResponse<any>>(
          `/api/reports/user-wise?${params}`,
        );
        setUserWiseData(response.rows);
        setUserTotal(response.total);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load user report");
      } finally {
        setUserLoading(false);
      }
    };

    void loadUserReport();
  }, [role, capabilities?.userWise, dateParams, userPage, userPageSize]);

  useEffect(() => {
    if (isAdmin) {
      setUserPage(1);
      setManagerPage(1);
      setDeptPage(1);
    }
  }, [adminFilters, isAdmin]);

  useEffect(() => {
    if (!canAccessReports(role) || !capabilities) return;

    const loadSummaryReports = async () => {
      setSummaryLoading(true);
      setError(null);
      try {
        const params = dateParams();

        if (capabilities.managerWise) {
          const managerRes = await apiFetch<{ rows: any[] }>(
            `/api/reports/manager-wise?${params}`,
          );
          setManagerWiseData(managerRes.rows);
          setManagerPage(1);
        } else {
          setManagerWiseData([]);
        }

        if (capabilities.departmentWise) {
          const deptRes = await apiFetch<{ rows: any[] }>(
            `/api/reports/department-wise?${params}`,
          );
          setDeptWiseData(deptRes.rows);
          setDeptPage(1);
        } else {
          setDeptWiseData([]);
        }

        if (capabilities.organizationWise) {
          const orgRes = await apiFetch<{ rows: any[] }>(
            "/api/reports/organization-wise",
          );
          setOrgWiseData(orgRes.rows);
          setOrgPage(1);
        } else {
          setOrgWiseData([]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load reports");
      } finally {
        setSummaryLoading(false);
      }
    };

    void loadSummaryReports();
  }, [role, capabilities, dateParams]);

  const openEmployeeDetail = useCallback(
    async (row: UserReportRow) => {
      setSelectedEmployee(row);
      setEmployeeDetail(null);
      setDetailError(null);
      setDetailLoading(true);

      try {
        const params = dateParams();
        params.set("empId", row.empId);
        const detail = await apiFetch<EmployeeTimesheetDetail>(
          `/api/reports/employee-timesheets?${params}`,
        );
        setEmployeeDetail(detail);
      } catch (err: unknown) {
        setDetailError(
          err instanceof Error ? err.message : "Failed to load task details",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [dateParams],
  );

  const userColumns = useMemo<ColumnsType<UserReportRow>>(
    () => [
      {
        title: "Emp ID",
        dataIndex: "empId",
        key: "empId",
        className: "text-gray-500",
      },
      {
        title: "Employee",
        dataIndex: "name",
        key: "name",
        render: (text: string, record: UserReportRow) => (
          <Space
            className="cursor-pointer hover:text-[#F5A623] transition-colors"
            onClick={() => void openEmployeeDetail(record)}
          >
            <Avatar className="!bg-[#fbb33b] text-white font-bold" size="small">
              {getNameInitials(text)}
            </Avatar>
            <span className="font-medium">{text}</span>
          </Space>
        ),
      },
      { title: "Department", dataIndex: "department", key: "department" },
      { title: "Reporting Manager", dataIndex: "manager", key: "manager" },
      {
        title: "Logged Hours",
        dataIndex: "hours",
        key: "hours",
        render: (val: number) => <span className="font-semibold">{formatDuration(val)}</span>,
      },
      {
        title: "Utilization",
        dataIndex: "utilization",
        key: "utilization",
        render: (val: number) => (
          <span className={val > 100 ? "text-orange-500" : "text-green-600"}>{val}%</span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (val: string) => (
          <Tag color={val === "Submitted" ? "green" : "orange"}>{val}</Tag>
        ),
      },
    ],
    [openEmployeeDetail],
  );

  const timesheetRows = useMemo(() => {
    if (!employeeDetail) return [];

    const rows: TimesheetTableRow[] = [];
    employeeDetail.days.forEach((day) => {
      if (day.tasks.length === 0) {
        rows.push({
          key: `${day.date}-empty`,
          date: day.date,
          timeSlot: "—",
          title: "—",
          description: "No tasks recorded",
          hours: day.totalHours || null,
        });
        return;
      }

      day.tasks.forEach((task, index) => {
        rows.push({
          key: `${day.date}-${index}`,
          date: day.date,
          timeSlot: task.timeSlot,
          title: getTaskDisplayTitle(task),
          description: task.task || "—",
          hours: calculateSlotHours(task.timeSlot),
        });
      });
    });

    return rows;
  }, [employeeDetail]);

  const handlePeriodChange = (value: PeriodPreset) => {
    const nextCustomRange =
      value === "custom"
        ? getEffectiveDateRange(periodPreset, customRange)
        : null;
    if (value === "custom") {
      setCustomRange(nextCustomRange);
    } else {
      setCustomRange(null);
    }
    setPeriodPreset(value);
    setUserPage(1);
    syncReportsUrl(adminFilters, value, nextCustomRange);
  };

  const handleDateRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates?.[0] && dates?.[1]) {
      const nextRange: [dayjs.Dayjs, dayjs.Dayjs] = [dates[0], dates[1]];
      setPeriodPreset("custom");
      setCustomRange(nextRange);
      setUserPage(1);
      syncReportsUrl(adminFilters, "custom", nextRange);
    }
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const params = dateParams();
      params.set("tab", activeTab);
      const from = dateRange[0].format("YYYY-MM-DD");
      const to = dateRange[1].format("YYYY-MM-DD");
      await downloadFile(
        `/api/reports/export/excel?${params}`,
        `${activeTab}-report-${from}-to-${to}.xlsx`,
      );
      messageApi.success("Excel file downloaded.");
    } catch (err: unknown) {
      messageApi.error(
        err instanceof Error ? err.message : "Failed to export Excel file",
      );
    } finally {
      setExporting(null);
    }
  };

  // const handleExportPdf = async () => {
  //   setExporting("pdf");
  //   try {
  //     const params = dateParams();
  //     params.set("tab", activeTab);
  //     const from = dateRange[0].format("YYYY-MM-DD");
  //     const to = dateRange[1].format("YYYY-MM-DD");
  //     await downloadFile(
  //       `/api/reports/export/pdf?${params}`,
  //       `${activeTab}-report-${from}-to-${to}.pdf`,
  //     );
  //     messageApi.success("PDF file downloaded.");
  //   } catch (err: unknown) {
  //     messageApi.error(
  //       err instanceof Error ? err.message : "Failed to export PDF file",
  //     );
  //   } finally {
  //     setExporting(null);
  //   }
  // };

  if (!canAccessReports(role)) {
    return null;
  }

  if (capabilitiesLoading || !capabilities) {
    return (
      <div className="p-4 md:p-6 flex justify-center items-center min-h-[360px]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      {contextHolder}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-4">
        <div>
          <Title level={2} className="!mb-1 text-xl md:text-3xl">
            {isAdmin ? "Organization Reports" : "Team Reports"}
          </Title>
          {/* <p className="text-gray-500 text-sm md:text-base">
            {isAdmin
              ? "Full access to utilization reports across the organization."
              : "Timesheet and utilization reports for your direct reports and downline."}
          </p> */}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Select
            value={periodPreset}
            onChange={handlePeriodChange}
            className="w-full sm:w-44"
            options={PERIOD_PRESET_OPTIONS}
          />
          <RangePicker
            className="w-full sm:w-auto"
            value={dateRange}
            onChange={handleDateRangeChange}
            disabled={periodPreset !== "custom"}
          />
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
            loading={exporting === "excel"}
          >
            Export Excel
          </Button>
          {/* <Button
            icon={<FilePdfOutlined />}
            onClick={handleExportPdf}
            loading={exporting === "pdf"}
          >
            Export PDF
          </Button> */}
        </div>
      </div>

      {error && <Alert type="error" title={error} showIcon className="mb-4" />}

      {isAdmin && (
        <Card
          variant="borderless"
          className="shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl !mb-3"
          styles={{ body: { padding: 20 } }}
          title={
            <span className="flex items-center gap-2 text-base font-semibold">
              <FilterOutlined className="text-[#F5A623]" />
              Report Filters
            </span>
          }
          extra={
            hasActiveReportFilters(adminFilters) ? (
              <Button
                type="link"
                size="small"
                className="!text-gray-500 hover:!text-[#F5A623]"
                onClick={() => handleAdminFiltersChange(DEFAULT_REPORT_FILTERS)}
              >
                Clear all
              </Button>
            ) : null
          }
        >
          <AdminReportFilters
            value={adminFilters}
            options={filterOptions}
            loading={filterOptionsLoading && !filterOptions}
            onChange={handleAdminFiltersChange}
          />
        </Card>
      )}

      <Card className="shadow-sm border-gray-100 dark:border-zinc-800 rounded-xl">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyOnHidden={false}
          items={[
            {
              key: "user",
              label: "User-wise Report",
              children: (
                <ReportTable
                  columns={userColumns}
                  data={userWiseData}
                  loading={userLoading}
                  scrollX={900}
                  emptyText="No user-wise report data for the selected period."
                  cardRender={(record: any, index: number) => (
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Header: #index + Avatar + Name + Status tag */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => void openEmployeeDetail(record)}>
                          <div className="flex shrink-0 items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-orange-200 text-orange-500 text-[10px] sm:text-xs font-bold bg-orange-50">
                            #{index + 1}
                          </div>
                          <Avatar className="!bg-[#fbb33b] shrink-0 text-white font-bold" size={32}>
                            {getNameInitials(record.name)}
                          </Avatar>
                          <span className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#F5A623] transition-colors text-sm sm:text-base break-words">
                            {record.name}
                          </span>
                        </div>
                        <Tag color={record.status === "Submitted" ? "green" : "orange"} className="m-0 border-0 shadow-sm font-medium shrink-0 text-[10px] sm:text-xs">
                          {record.status}
                        </Tag>
                      </div>

                      {/* Body Grid */}
                      <div className="grid grid-cols-2 gap-y-3 gap-x-3 mt-1 sm:mt-2">
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Emp ID</div>
                          <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">{record.empId}</div>
                        </div>
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Department</div>
                          <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">{record.department}</div>
                        </div>
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Reporting Manager</div>
                          <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">{record.manager}</div>
                        </div>
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Logged Hours</div>
                          <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">{formatDuration(record.hours)}</div>
                        </div>
                      </div>

                      <div className="mt-1">
                        <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Utilization</div>
                        <div className={`font-bold text-xs sm:text-sm ${record.utilization >= 100 ? "text-green-600" : "text-green-600"}`}>
                          {record.utilization}%
                        </div>
                      </div>
                    </div>
                  )}
                  pagination={{
                    current: userPage,
                    pageSize: userPageSize,
                    total: userTotal,
                    onChange: (page, pageSize) => {
                      setUserPage(page);
                      setUserPageSize(pageSize);
                    },
                  }}
                />
              ),
            },
            ...(capabilities.managerWise
              ? [
                {
                  key: "manager",
                  label: "Manager-wise Report",
                  children: (
                    <ReportTable
                      columns={managerColumns}
                      data={managerWiseData}
                      loading={summaryLoading}
                      scrollX={800}
                      emptyText="No manager-wise report data for the selected period."
                      pagination={{
                        current: managerPage,
                        pageSize: managerPageSize,
                        total: managerWiseData.length,
                        onChange: (page, pageSize) => {
                          setManagerPage(page);
                          setManagerPageSize(pageSize);
                        },
                      }}
                    />
                  ),
                },
              ]
              : []),
            ...(capabilities.departmentWise
              ? [
                {
                  key: "dept",
                  label: "Department-wise Report",
                  children: (
                    <ReportTable
                      columns={deptColumns}
                      data={deptWiseData}
                      loading={summaryLoading}
                      scrollX={700}
                      emptyText="No department-wise report data for the selected period."
                      pagination={{
                        current: deptPage,
                        pageSize: deptPageSize,
                        total: deptWiseData.length,
                        onChange: (page, pageSize) => {
                          setDeptPage(page);
                          setDeptPageSize(pageSize);
                        },
                      }}
                    />
                  ),
                },
              ]
              : []),
            ...(capabilities.organizationWise
              ? [
                {
                  key: "org",
                  label: "Organization-wise Report",
                  children: (
                    <ReportTable
                      columns={orgColumns}
                      data={orgWiseData}
                      loading={summaryLoading}
                      scrollX={700}
                      emptyText="No organization-wide report data available."
                      pagination={{
                        current: orgPage,
                        pageSize: orgPageSize,
                        total: orgWiseData.length,
                        onChange: (page, pageSize) => {
                          setOrgPage(page);
                          setOrgPageSize(pageSize);
                        },
                      }}
                    />
                  ),
                },
              ]
              : []),
          ]}
        />
      </Card>

      <Modal
        title="Timesheet"
        open={!!selectedEmployee}
        onCancel={() => {
          setSelectedEmployee(null);
          setEmployeeDetail(null);
          setDetailError(null);
        }}
        footer={null}
        centered
        width={900}
        destroyOnHidden
        styles={{
          body: { overflow: "hidden", paddingBottom: 24 },
        }}
      >
        {selectedEmployee && (
          <div className="flex flex-col">
            <p className="text-center text-sm text-gray-500">
              {dateRange[0].format("MMM D, YYYY")} –{" "}
              {dateRange[1].format("MMM D, YYYY")}
            </p>

            {detailLoading ? (
              <div className="flex justify-center py-16">
                <Spin size="large" />
              </div>
            ) : detailError ? (
              <Alert type="error" title={detailError} showIcon className="mt-6" />
            ) : employeeDetail ? (
              timesheetRows.length > 0 ? (
                <div className="bg-white dark:bg-zinc-950 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 p-0 sm:p-4 mt-6">
                  <ResponsiveTable
                    columns={timesheetColumns}
                    dataSource={timesheetRows}
                    pagination={false}
                    rowClassName={(record: any) =>
                      record.hours === null ? "bg-gray-50 dark:bg-zinc-900/50 italic text-gray-500" : ""
                    }
                  />
                </div>
              ) : (
                <Empty
                  className="mt-6"
                  description="No timesheet entries found for the selected period."
                />
              )
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
