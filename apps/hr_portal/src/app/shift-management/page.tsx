"use client";

import React, { useEffect, useState } from "react";
import { Button, Table, Typography, Upload, Tag, message, Tabs, Modal, Spin } from "antd";
import { UploadOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { apiFetch, API_BASE, getAuthHeaders } from "@/lib/api";
import dayjs from "dayjs";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import {
  DEFAULT_REPORT_FILTERS,
  appendReportFilters,
  type ReportFilters,
  type ReportFilterOptions,
} from "@/lib/reportFilters";

const { Title } = Typography;

export default function ShiftManagementPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<any[]>([]);
  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [selectedJobErrors, setSelectedJobErrors] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);

  const [adminFilters, setAdminFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
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
      const params = new URLSearchParams();
      appendReportFilters(params, adminFilters);
      const data = await apiFetch<any[]>(`/api/admin/employee-shifts?${params}`);
      setEmployeeShifts(data);
    } catch (error) {
      console.error("Failed to fetch employee shifts", error);
    }
  };

  useEffect(() => {
    void fetchEmployeeShifts();
  }, [adminFilters]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchHistory(), fetchEmployeeShifts()]);
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

  const historyColumns = [
    { title: "File Name", dataIndex: "fileName", key: "fileName" },
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
      render: (s: string) => (
        <Tag color={s === "completed" ? "success" : s === "failed" ? "error" : "processing"}>
          {s?.toUpperCase()}
        </Tag>
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
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="!m-0 text-gray-800">Shift Management</Title>
        <div className="flex gap-2">
          <Button 
            type="default" 
            icon={<InfoCircleOutlined />} 
            onClick={() => setIsRulesModalVisible(true)}
          >
            View Shift Rules
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
                  onChange={setAdminFilters}
                />
                <Table
                  dataSource={employeeShifts}
                  columns={employeeColumns}
                  rowKey="employeeId"
                  loading={loading}
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 20 }}
                />
              </div>
            ),
          },
          {
            key: "2",
            label: "Upload History",
            children: (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-2">
                <div className="flex justify-end mb-4">
                  <Button onClick={fetchHistory} loading={loading}>Refresh Status</Button>
                </div>
                <Table
                  dataSource={history}
                  columns={historyColumns}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
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
            <div className="bg-gray-50 p-4 rounded border border-gray-200 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>• Employment Status</div>
              <div>• Employee Id</div>
              <div>• Full Name</div>
              <div>• Job Title</div>
              <div>• Department</div>
              <div>• Sub Department</div>
              <div>• Direct Manager Employee Id</div>
              <div>• Direct Manager Name</div>
              <div>• HRBP Employee ID</div>
              <div>• HRBP Name</div>
              <div>• Hod Employee Id</div>
              <div>• Hod Employee Name</div>
              <div>• Official Email Id</div>
              <div>• Office Mobile Number</div>
              <div>• Zone</div>
              <div>• Attendance Shift</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Tab 2: Shift Details</h3>
            <p className="text-sm mb-3">This sheet creates or updates the shift rules themselves (e.g. what times make up a General shift). It requires these exact headers:</p>
            <div className="bg-gray-50 p-4 rounded border border-gray-200 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>• Shift Name</div>
              <div>• Allowed Timings</div>
              <div>• Working Days</div>
              <div>• Off Days</div>
              <div>• Half Day</div>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mt-4">
            <InfoCircleOutlined className="mr-2" />
            <strong>Note:</strong> The system automatically looks for the sheets by name or header contents. Ensure the <strong>Attendance Shift</strong> in Tab 1 matches a <strong>Shift Name</strong> in Tab 2 exactly!
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
          <Table 
            dataSource={selectedJobErrors}
            rowKey={(r) => `err-${r.rowIndex}`}
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
