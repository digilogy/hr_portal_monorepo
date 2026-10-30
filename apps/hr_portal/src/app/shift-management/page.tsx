"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button, Table, Typography, Upload, Tag, message, Tabs, Modal, Spin, Popconfirm } from "antd";
import { UploadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, API_BASE, getAuthHeaders } from "@/lib/api";
import dayjs from "dayjs";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import {
  DEFAULT_REPORT_FILTERS,
  appendReportFilters,
  parseReportFiltersFromSearchParams,
  reportFiltersToSearchParams,
  type ReportFilters,
  type ReportFilterOptions,
} from "@/lib/reportFilters";
import { getTokenRole, getTokenEmail, type UserRole } from "@/lib/auth";

import { ResponsiveTable } from "@/components/ui/ResponsiveTable";

const { Title } = Typography;

export default function ShiftManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [selectedJobErrors, setSelectedJobErrors] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setRole(getTokenRole());
    setEmail(getTokenEmail());
  }, []);

  const isAdmin = role === "admin" && email !== "superadmin@casagrand.co.in";

  const [adminFilters, setAdminFilters] = useState<ReportFilters>(() => {
    return parseReportFiltersFromSearchParams(searchParams);
  });

  const syncShiftMgmtUrl = useCallback(
    (filters: ReportFilters) => {
      const params = reportFiltersToSearchParams(filters);
      const query = params.toString();
      router.replace(query ? `/shift-management?${query}` : "/shift-management", { scroll: false });
    },
    [router],
  );

  const handleAdminFiltersChange = useCallback(
    (filters: ReportFilters) => {
      setAdminFilters(filters);
      syncShiftMgmtUrl(filters);
    },
    [syncShiftMgmtUrl],
  );

  const handleClearAllShiftMgmtFilters = useCallback(() => {
    const defaultFilters = DEFAULT_REPORT_FILTERS;
    setAdminFilters(defaultFilters);
    syncShiftMgmtUrl(defaultFilters);
  }, [syncShiftMgmtUrl]);
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null);

  useEffect(() => {
    void apiFetch<ReportFilterOptions>("/api/reports/filter-options")
      .then(setFilterOptions)
      .catch(console.error);
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await apiFetch<any[]>("/api/admin/bulk-upload/history");
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  const fetchEmployeeShifts = async () => {
    try {
      setLoadingShifts(true);
      const params = new URLSearchParams();
      appendReportFilters(params, adminFilters);
      const data = await apiFetch<any[]>(`/api/admin/employee-shifts?${params}`);
      setEmployeeShifts(data);
    } catch (error) {
      console.error("Failed to fetch employee shifts", error);
    } finally {
      setLoadingShifts(false);
    }
  };

  useEffect(() => {
    void fetchEmployeeShifts();
  }, [adminFilters]);

  const loadData = async () => {
    setLoading(true);
    // await Promise.all([fetchHistory(), fetchEmployeeShifts()]);
    await fetchHistory();

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const currentlyProcessing = history.some((job) => job.status === "queued" || job.status === "processing");
    if (isProcessing && !currentlyProcessing) {
      // A job just finished processing, refresh the employee table
      void fetchEmployeeShifts();
    }
    setIsProcessing(currentlyProcessing);
  }, [history]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isProcessing) {
      interval = setInterval(() => {
        void fetchHistory();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  const handleUpload = async (file: File, endpoint: string, successMsg: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }
      messageApi.success(successMsg);
      void fetchHistory();
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : "Upload failed.");
    }
    setUploading(false);
  };

  const handleCancelUpload = async (jobId: string) => {
    try {
      await apiFetch(`/api/admin/bulk-upload/${jobId}/cancel`, { method: "POST" });
      messageApi.success("Upload cancelled.");
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : "Failed to cancel upload.");
    }
    void fetchHistory();
  };

  const handleViewErrors = async (jobId: string) => {
    setErrorModalVisible(true);
    setLoadingErrors(true);
    setSelectedJobErrors([]);
    try {
      const data = await apiFetch<any>(`/api/admin/bulk-upload/status/${jobId}`);
      setSelectedJobErrors(data.job?.errors || []);
    } catch (error) {
      messageApi.error("Failed to load errors");
    }
    setLoadingErrors(false);
  };

  const employeeColumns = [
    { title: "Emp ID", dataIndex: "employeeId", key: "employeeId" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Department", dataIndex: "department", key: "department" },
    { title: "Shift Name", dataIndex: "shiftName", key: "shiftName" },
    { title: "Allowed Timings", dataIndex: "shiftTimings", key: "shiftTimings" },
    { title: "Working Days", dataIndex: "workingDays", key: "workingDays" },
    { title: "Off Days", dataIndex: "offDays", key: "offDays" },
    { title: "Half Day (Optional)", dataIndex: "halfDay", key: "halfDay" },
  ];

  const handleDownload = async (jobId: string, fileName: string) => {
    try {
      const token = localStorage.getItem("token");
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5111"}/api/admin/bulk-upload/download/${jobId}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to download file");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (error: any) {
      messageApi.error(error.message || "Failed to download file");
    }
  };

  const historyColumns = [
    {
      title: "File Name",
      dataIndex: "fileName",
      key: "fileName",
      render: (fileName: string, row: any) => (
        <button
          onClick={() => handleDownload(row.id, fileName)}
          className="text-[#F5A623] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-left"
        >
          {fileName}
        </button>
      )
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (t: string) => <Tag color="blue">{t?.toUpperCase()}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string, row: any) => (
        <div className="flex flex-col items-start gap-1">
          <Tag color={s === "completed" ? "success" : s === "failed" ? "error" : "processing"}>
            {s?.toUpperCase()}
          </Tag>
          {(s === "queued" || s === "processing") && (
            <Popconfirm
              title="Cancel this upload?"
              description="Rows already imported are kept. You can upload the file again afterwards."
              okText="Cancel upload"
              okButtonProps={{ danger: true }}
              cancelText="Keep running"
              onConfirm={() => handleCancelUpload(row.id)}
            >
              <Button type="link" danger size="small" className="!p-0">
                Cancel
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
    { title: "Total Rows", dataIndex: "totalRows", key: "totalRows" },
    { title: "Success", dataIndex: "successCount", key: "successCount" },
    { title: "Failed", dataIndex: "failureCount", key: "failureCount" },
    {
      title: "Error Reason",
      key: "errorReason",
      render: (row: any) => {
        if (row.errorMessage) return <span className="text-red-500">{row.errorMessage}</span>;
        if (row.failureCount > 0) {
          return (
            <Button type="link" danger size="small" onClick={() => handleViewErrors(row.id)}>
              View {row.failureCount} Errors
            </Button>
          );
        }
        return "-";
      },
    },
    {
      title: "Uploaded At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => dayjs(d).format("MMM D, YYYY HH:mm"),
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {contextHolder}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-6">
        <Title level={2} className="!m-0 text-gray-800">Shift Management</Title>
        <div className="flex flex-nowrap gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {!isAdmin && (
            <>
              <Button
                type="default"
                icon={<InfoCircleOutlined />}
                onClick={() => setIsRulesModalVisible(true)}
              >
                Shift Rules
              </Button>
              <Upload
                accept=".csv,.xlsx,.xls"
                beforeUpload={(file) => {
                  void handleUpload(file, "/api/admin/bulk-upload-master", "Master data upload queued.");
                  return false;
                }}
                showUploadList={false}
                disabled={uploading || isProcessing}
              >
                <Button icon={<UploadOutlined />} loading={uploading || isProcessing}>
                  Upload Master Data
                </Button>
              </Upload>
            </>
          )}
        </div>
      </div>

      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "Employee Shifts",
            children: (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-2 flex flex-col gap-4">
                <AdminReportFilters
                  value={adminFilters}
                  options={filterOptions}
                  loading={!filterOptions && loading}
                  hideStatus={true}
                  onChange={handleAdminFiltersChange}
                  onClearAll={handleClearAllShiftMgmtFilters}
                />
                <ResponsiveTable
                  dataSource={employeeShifts}
                  columns={employeeColumns}
                  rowKey="employeeId"
                  loading={loadingShifts}
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
          ...(!isAdmin ? [{
            key: "2",
            label: "Upload History",
            children: (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-2">
                <ResponsiveTable
                  dataSource={history}
                  columns={historyColumns}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          }] : []),
        ]}
      />

      <Modal
        title="Upload Rules & Formatting"
        open={isRulesModalVisible}
        onCancel={() => setIsRulesModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsRulesModalVisible(false)}>
            Close
          </Button>
        ]}
        width={750}
      >
        <div className="space-y-6 text-gray-600 max-h-[70vh] overflow-y-auto pr-2">
          <p>
            When preparing the Master Data file for upload, your Excel file should contain <strong>two sheets (tabs)</strong>.
          </p>

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Tab 1: Employee data</h3>
            <p className="text-sm mb-3">This sheet creates or updates employee records and assigns their shifts. It requires these exact headers:</p>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm grid grid-cols-2 gap-y-2 mb-6">
              <span>• Employment Status</span>
              <span>• Employee Id</span>
              <span>• Full Name</span>
              <span>• Job Title</span>
              <span>• Department</span>
              <span>• Sub Department</span>
              <span>• Direct Manager Employee Id</span>
              <span>• Direct Manager Name</span>
              <span>• HRBP Employee ID</span>
              <span>• HRBP Name</span>
              <span>• Hod Employee Id</span>
              <span>• Hod Employee Name</span>
              <span>• Official Email Id</span>
              <span>• Office Mobile Number</span>
              <span>• Zone</span>
              <span>• Policy</span>
              <span>• Shift Name</span>
              <span>• Weekly Off</span>
            </div>
            <p className="text-xs">
              <strong>Weekly Off</strong> sets each employee&apos;s off days; working days are every other day. Accepted values: All Sunday &amp; 2nd Saturday Off, All Sunday Off, General Off, Office Off, All Tuesday Off, Tuesday Off, Marketing Off, All Thursday Off, or &quot;All &lt;Day&gt; Off&quot;.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Tab 2: Shift Detail</h3>
            <p className="text-sm mb-3">This sheet creates or updates the shift rules themselves (e.g. what times make up a General shift). It requires these exact headers:</p>
            <div className="bg-gray-50 p-4 rounded border border-gray-200 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>• Shift Name</div>
              <div>• Allowed Timings</div>
              <div>• Half Day (Optional)</div>
            </div>
            <p className="text-xs mt-2">
              Allowed Timings: HH:MM - HH:MM (e.g. 09:30 - 19:30), several separated by commas. Half Day: Day (HH:MM - HH:MM), e.g. Sat (08:00 - 12:30), or several days sharing one timing, e.g. Sat, Sun (09:30 - 19:30). Those days use this timing instead of Allowed Timings. A Shift Name may repeat only with the same timings and half day.
            </p>
          </div>

          <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mt-4">
            <InfoCircleOutlined className="mr-2" />
            <strong>Note:</strong> The system automatically looks for the sheets by name or header contents. Ensure the <strong>Employee data</strong> in Tab 1 matches a <strong>Shift Detail</strong> in Tab 2 exactly!
          </div>
        </div>
      </Modal>

      <Modal
        title="Upload Errors"
        open={errorModalVisible}
        onCancel={() => setErrorModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setErrorModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {loadingErrors ? (
          <div className="flex justify-center p-8"><Spin /></div>
        ) : (
          <ResponsiveTable
            dataSource={selectedJobErrors}
            rowKey={(r) => `err-${r.id ?? r.rowIndex}`}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "Row", dataIndex: "rowIndex", width: 80 },
              { title: "Employee ID", dataIndex: "employeeId", width: 120 },
              { title: "Error", dataIndex: "error" },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
