"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button, Input, Popconfirm, Result, Select, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiFetch } from "@/lib/api";
import { getTokenEmail, isSuperAdmin } from "@/lib/auth";

const { Title, Text } = Typography;

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogEntry {
  id?: string;
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
  source?: string;
  service?: string;
}

const REFRESH_MS = 5000;

const LEVEL_COLORS: Record<LogLevel, string> = {
  ERROR: "red",
  WARN: "orange",
  INFO: "blue",
  DEBUG: "purple",
};

const SERVICE_OPTIONS = [
  { label: "All services", value: "all" },
  { label: "Browser (web)", value: "web" },
  { label: "Main API", value: "api" },
  { label: "Admin", value: "admin" },
  { label: "Reports", value: "reports" },
  { label: "Mail worker", value: "worker" },
];

const LEVEL_OPTIONS = [
  { label: "Errors only", value: "ERROR" },
  { label: "Warnings", value: "WARN" },
  { label: "Info", value: "INFO" },
  { label: "All levels", value: "ALL" },
];

const LIMIT_OPTIONS = [100, 200, 500, 1000].map((n) => ({ label: `${n} entries`, value: n }));

const columns: ColumnsType<LogEntry> = [
  {
    title: "Time",
    dataIndex: "timestamp",
    width: 170,
    render: (ts: string) => <span className="whitespace-nowrap">{dayjs(ts).format("DD MMM, HH:mm:ss")}</span>,
  },
  {
    title: "Level",
    dataIndex: "level",
    width: 90,
    render: (level: LogLevel) => <Tag color={LEVEL_COLORS[level]}>{level}</Tag>,
  },
  {
    title: "Service",
    dataIndex: "service",
    width: 100,
    render: (service?: string) => service || "api",
  },
  {
    title: "Context",
    dataIndex: "context",
    width: 180,
    render: (context: string) => <span className="break-all">{context}</span>,
  },
  {
    title: "Message",
    dataIndex: "message",
    render: (msg: string) => <span className="break-all">{msg}</span>,
  },
];

function LogDetails({ entry }: { entry: LogEntry }) {
  const { stack, ...rest } = entry.meta ?? {};
  return (
    <div className="flex flex-col gap-3">
      {Object.keys(rest).length > 0 && (
        <pre className="m-0 p-3 bg-gray-50 rounded text-xs whitespace-pre-wrap break-all">
          {JSON.stringify(rest, null, 2)}
        </pre>
      )}
      {typeof stack === "string" && (
        <div>
          <Text strong>Stack trace</Text>
          <pre className="m-0 mt-1 p-3 bg-gray-50 rounded text-xs whitespace-pre-wrap break-all">{stack}</pre>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState("ERROR");
  const [service, setService] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    setAllowed(isSuperAdmin(getTokenEmail()));
  }, []);

  const loadLogs = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const query = new URLSearchParams({ level, service, search, limit: String(limit) });
        const data = await apiFetch<{ logs: LogEntry[] }>(`/api/system/logs?${query.toString()}`);
        // Entries stored before ids were added have none; fall back to their position.
        setLogs(data.logs.map((entry, index) => ({ ...entry, id: entry.id ?? `legacy-${index}` })));
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "Failed to load logs");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [level, service, search, limit, messageApi],
  );

  useEffect(() => {
    if (!allowed) return;
    void loadLogs(true);
  }, [allowed, loadLogs]);

  useEffect(() => {
    if (!allowed || !autoRefresh) return;
    const interval = setInterval(() => void loadLogs(false), REFRESH_MS);
    return () => clearInterval(interval);
  }, [allowed, autoRefresh, loadLogs]);

  const clearLogs = async () => {
    try {
      await apiFetch("/api/system/logs/clear", { method: "POST" });
      messageApi.success("Logs cleared");
      void loadLogs(true);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "Failed to clear logs");
    }
  };

  if (allowed === null) return null;

  if (!allowed) {
    return <Result status="403" title="Superadmin only" subTitle="You don't have access to this page." />;
  }

  return (
    <div className="p-6">
      {contextHolder}
      <Title level={2} className="!mb-1">Logs</Title>
      <Text type="secondary">
        Errors and activity from the browser, the API services and the mail worker. Only the most recent 2,000
        entries are kept.
      </Text>

      <div className="flex flex-wrap items-center gap-2 mt-6 mb-4">
        <Select value={level} onChange={setLevel} options={LEVEL_OPTIONS} style={{ width: 140 }} />
        <Select value={service} onChange={setService} options={SERVICE_OPTIONS} style={{ width: 160 }} />
        <Select value={limit} onChange={setLimit} options={LIMIT_OPTIONS} style={{ width: 140 }} />
        <Input.Search
          allowClear
          placeholder="Search message, page, user…"
          onSearch={setSearch}
          style={{ width: 280 }}
        />
        <div className="flex items-center gap-2 ml-auto">
          <Switch checked={autoRefresh} onChange={setAutoRefresh} />
          <Text>Auto-refresh</Text>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs(true)}>
            Refresh
          </Button>
          <Popconfirm
            title="Clear all stored logs?"
            description="This removes them for everyone and cannot be undone."
            okText="Clear"
            okButtonProps={{ danger: true }}
            onConfirm={clearLogs}
          >
            <Button danger>Clear</Button>
          </Popconfirm>
        </div>
      </div>

      <Table<LogEntry>
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        scroll={{ x: 900 }}
        expandable={{
          expandedRowRender: (entry) => <LogDetails entry={entry} />,
          rowExpandable: (entry) => Boolean(entry.meta && Object.keys(entry.meta).length > 0),
        }}
        locale={{ emptyText: "No log entries match these filters" }}
      />
    </div>
  );
}
