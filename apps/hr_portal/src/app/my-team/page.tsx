"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Typography,
  Tag,
  Avatar,
  Space,
  Row,
  Col,
  Spin,
  Alert,
  Empty,
  Drawer,
  Descriptions,
  Grid,
  Segmented
} from "antd";
import type { TablePaginationConfig } from "antd/es/table";
import {
  UserOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  AppstoreOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { canAccessTeam, getNameInitials, getTokenRole } from "@/lib/auth";
import {
  appendDepartmentFilter,
  DEFAULT_DEPARTMENT_FILTER,
  hasActiveDepartmentFilter,
  type DepartmentFilter,
  type DepartmentFilterOptions,
} from "@/lib/reportFilters";
import { AdminDepartmentFilter } from "@/components/reports/AdminDepartmentFilter";
import { AdminReportFilters } from "@/components/reports/AdminReportFilters";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import { useSearchParams } from "next/navigation";

const { Title, Text } = Typography;

interface TeamMemberNode {
  key: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  subDepartment: string;
  manager: string;
  hod: string;
  phone: string;
  status: string;
  hours: number;
  utilization: number;
  timesheetStatus: "Submitted" | "Pending";
  children?: TeamMemberNode[];
}

interface TeamResponse {
  members: TeamMemberNode[];
  total: number;
  page: number;
  pageSize: number;
  viewMode: "flat" | "tree";
  summary: {
    totalMembers: number;
    submittedCount: number;
    avgUtilization: number;
  };
}

type RosterCardFilter =
  | "all"
  | "active"
  | "Submitted"
  | "Pending"
  | "on_track"
  | "needs_attention";

const ROSTER_CARD_FILTER_LABELS: Record<RosterCardFilter, string> = {
  all: "All team members",
  active: "Active employees",
  Submitted: "Timesheets submitted",
  Pending: "Pending timesheets",
  on_track: "On track (≥90% utilization)",
  needs_attention: "Needs attention (<90% utilization)",
};

export default function MyTeamPage() {
  const router = useRouter();
  const role = getTokenRole();
  const isAdmin = role === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeamMemberNode[]>([]);
  const [summary, setSummary] = useState<TeamResponse["summary"] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<"flat" | "tree">("flat");
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [tableViewMode, setTableViewMode] = useState<"table" | "card">("table");

  useEffect(() => {
    if (isMobile) {
      setTableViewMode("card");
    } else {
      setTableViewMode("table");
    }
  }, [isMobile]);

  const [selectedMember, setSelectedMember] = useState<TeamMemberNode | null>(null);
  const [cardFilter, setCardFilter] = useState<RosterCardFilter>("all");
  const [adminFilters, setAdminFilters] = useState<DepartmentFilter>(
    DEFAULT_DEPARTMENT_FILTER,
  );
  const [filterOptions, setFilterOptions] = useState<DepartmentFilterOptions | null>(
    null,
  );
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const loadFilterOptions = async () => {
      setFilterOptionsLoading(true);
      try {
        const options = await apiFetch<DepartmentFilterOptions>(
          "/api/reports/filter-options",
        );
        setFilterOptions({ departments: options.departments });
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
    const role = getTokenRole();
    if (!canAccessTeam(role)) {
      router.replace("/timesheet");
      return;
    }

    const loadTeam = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (cardFilter !== "all") {
          params.set("rosterFilter", cardFilter);
        }
        if (isAdmin) {
          appendDepartmentFilter(params, adminFilters);
        }
        const response = await apiFetch<TeamResponse>(
          `/api/team/roster?${params}`,
        );
        setData(response.members);
        setSummary(response.summary);
        setTotal(response.total);
        setViewMode(response.viewMode);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load team data");
      } finally {
        setLoading(false);
      }
    };

    void loadTeam();
  }, [router, isAdmin, adminFilters, cardFilter, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: "Emp ID",
        dataIndex: "employeeId",
        key: "employeeId",
        className: "text-gray-500",
      },
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        render: (text: string, record: TeamMemberNode) => (
          <Space
            className="cursor-pointer hover:text-[#F5A623] transition-colors"
            onClick={() => setSelectedMember(record)}
          >
            <Avatar className="!bg-[#fbb33b] text-white font-bold" size="small">
              {getNameInitials(text)}
            </Avatar>
            <span className="font-medium">{text}</span>
          </Space>
        ),
      },
      { title: "Role", dataIndex: "role", key: "role" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: string) => (
          <Tag color={status.toLowerCase() === "active" ? "green" : "orange"}>
            {status}
          </Tag>
        ),
      },
      {
        title: "This Week's Hours",
        dataIndex: "hours",
        key: "hours",
        render: (val: number) => <span className="font-semibold">{val}h</span>,
      },
      {
        title: "Timesheet Status",
        dataIndex: "timesheetStatus",
        key: "timesheetStatus",
        render: (status: string) => (
          <Tag color={status === "Submitted" ? "green" : "orange"}>{status}</Tag>
        ),
      },
    ],
    [],
  );

  const teamStats = useMemo(() => {
    const totalMembers = summary?.totalMembers ?? 0;
    const submitted = summary?.submittedCount ?? 0;
    const pending = Math.max(0, totalMembers - submitted);
    const submissionRate = totalMembers > 0 ? (submitted / totalMembers) * 100 : 0;
    const utilization = summary?.avgUtilization ?? 0;

    return {
      total: totalMembers,
      submitted,
      pending,
      submissionRate,
      utilization,
      onTrack: utilization >= 90,
    };
  }, [summary]);

  const toggleCardFilter = (filter: RosterCardFilter) => {
    setCardFilter((current) => (current === filter ? "all" : filter));
    setPage(1);
  };
  const rosterTitle = isAdmin ? "Organization Roster" : "Team & Downline Roster";

  const tablePagination: TablePaginationConfig | false =
    viewMode === "tree"
      ? false
      : {
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ["25", "50", "100"],
        onChange: (nextPage, nextPageSize) => {
          setPage(nextPage);
          if (nextPageSize !== pageSize) {
            setPageSize(nextPageSize);
          }
        },
      };

  if (loading && !summary && data.length === 0) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <Title level={2} className="!mb-1 text-gray-900 dark:text-gray-100">
            My Team
          </Title>
          <p className="text-gray-500 text-sm md:text-base">
            Direct reports and full downline hierarchy with current timesheet status.
          </p>
        </div>
        {isAdmin && (
          <AdminDepartmentFilter
            value={adminFilters}
            options={filterOptions}
            loading={loading || filterOptionsLoading}
            onChange={(filters) => {
              setAdminFilters(filters);
              setPage(1);
            }}
          />
        )}
      </div>

      {error && <Alert type="error" message={error} showIcon className="mb-4" />}

      <Row gutter={[{ xs: 8, sm: 12, md: 16 }, { xs: 8, sm: 12, md: 16 }]}>
        <Col xs={12} sm={12} xl={6}>
          <DashboardMetricCard
            title="Total Team Members"
            valueLabel={String(teamStats.total)}
            targetLabel="members"
            percent={teamStats.total > 0 ? Math.min(100, (teamStats.submitted / teamStats.total) * 100) : 0}
            footerLeft="Active in master data"
            footerRight="Filter active"
            icon={<UserOutlined />}
            iconClassName="bg-blue-50 text-blue-500"
            barClassName="bg-blue-500"
            percentClassName="text-blue-500"
            onClick={() => toggleCardFilter("active")}
            active={cardFilter === "active"}
          />
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <DashboardMetricCard
            title="Timesheets Submitted"
            valueLabel={String(teamStats.submitted)}
            targetLabel={`/ ${teamStats.total}`}
            percent={teamStats.submissionRate}
            footerLeft="This week"
            footerRight={`${Math.round(teamStats.submissionRate)}%`}
            icon={<CheckCircleOutlined />}
            iconClassName="bg-green-50 text-green-500"
            barClassName="bg-green-500"
            percentClassName="text-green-500"
            onClick={() => toggleCardFilter("Submitted")}
            active={cardFilter === "Submitted"}
          />
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <DashboardMetricCard
            title="Pending Timesheets"
            valueLabel={String(teamStats.pending)}
            targetLabel="members"
            percent={teamStats.total > 0 ? Math.min(100, (teamStats.pending / teamStats.total) * 100) : 0}
            footerLeft="Action Required"
            footerRight={`${teamStats.total > 0 ? Math.round((teamStats.pending / teamStats.total) * 100) : 0}%`}
            icon={<ExclamationCircleOutlined />}
            iconClassName="bg-orange-50 text-[#F5A623]"
            barClassName="bg-[#F5A623]"
            percentClassName="text-[#F5A623]"
            onClick={() => toggleCardFilter("Pending")}
            active={cardFilter === "Pending"}
          />
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <DashboardMetricCard
            title="Avg Team Utilization"
            valueLabel={teamStats.utilization.toFixed(1)}
            targetLabel="%"
            percent={Math.min(teamStats.utilization, 100)}
            footerLeft={teamStats.onTrack ? "On Track" : "Needs Attention"}
            footerRight={`${Math.round(Math.min(teamStats.utilization, 100))}%`}
            icon={<SyncOutlined />}
            iconClassName="bg-cyan-50 text-cyan-500"
            barClassName="bg-cyan-500"
            percentClassName="text-cyan-500"
            onClick={() =>
              toggleCardFilter(teamStats.onTrack ? "on_track" : "needs_attention")
            }
            active={
              cardFilter === "on_track" || cardFilter === "needs_attention"
            }
          />
        </Col>
      </Row>

      <Card
        title={<span className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{rosterTitle}</span>}
        className="shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden"
        variant="borderless"
        extra={
          isMobile && (
            <Segmented
              options={[
                { label: "", value: "card", icon: <AppstoreOutlined /> },
                { label: "", value: "table", icon: <TableOutlined /> },
              ]}
              value={tableViewMode}
              onChange={(val) => setTableViewMode(val as "card" | "table")}
            />
          )
        }
      >
        {cardFilter !== "all" && (
          <div className="flex items-center gap-3 mb-4">
            <div className="px-4 py-1.5 rounded-full border border-orange-200 text-[#F5A623] bg-orange-50 font-medium text-xs sm:text-sm shadow-sm">
              {ROSTER_CARD_FILTER_LABELS[cardFilter]} ({total})
            </div>
            <button
              type="button"
              onClick={() => setCardFilter("all")}
              className="text-[#F5A623] hover:underline text-sm font-medium"
            >
              Clear
            </button>
          </div>
        )}

        {data.length > 0 ? (
          <ResponsiveTable
            rowKey="key"
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={tablePagination}
            hideToggle={true}
            viewMode={tableViewMode}
            onViewModeChange={(val) => setTableViewMode(val)}
            cardRender={(record: TeamMemberNode) => (
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Header: Avatar + Name/ID + Status */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => setSelectedMember(record)}>
                    <Avatar className="!bg-[#fbb33b] text-white font-bold" size={40}>
                      {getNameInitials(record.name)}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-[#F5A623] transition-colors text-sm sm:text-base">{record.name}</span>
                      <span className="text-gray-400 text-xs sm:text-sm">{record.employeeId}</span>
                    </div>
                  </div>
                  <Tag color={record.timesheetStatus === "Submitted" ? "green" : "orange"} className="m-0 border-0 shadow-sm font-medium text-[10px] sm:text-xs">
                    {record.timesheetStatus}
                  </Tag>
                </div>

                {/* Body: Role, Dept, Manager */}
                <div className="flex flex-col gap-1 sm:gap-2 mt-1 sm:mt-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-400">Role:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-right">{record.role}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-400">Department:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-right">{record.department}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-400">Manager:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-right">{record.manager}</span>
                  </div>
                </div>

                {/* Footer: Hours & Utilization */}
                <div className="flex justify-between items-center text-xs sm:text-sm mt-1 sm:mt-2 pt-2 sm:pt-3 border-t border-gray-100 dark:border-zinc-800">
                  <div>
                    <span className="text-gray-400">Hours: </span>
                    <span className="font-bold">{record.hours}h</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Utilization: </span>
                    <span className="font-bold text-[#F5A623]">{Math.round(record.utilization)}%</span>
                  </div>
                </div>
              </div>
            )}
            expandable={
              viewMode === "tree"
                ? {
                  defaultExpandAllRows: false,
                  indentSize: 24,
                }
                : undefined
            }
            className="[&_.ant-table-thead>tr>th]:bg-gray-50 dark:[&_.ant-table-thead>tr>th]:bg-zinc-900 [&_.ant-table-thead>tr>th]:font-semibold"
            scroll={{ x: "max-content" }}
          />
        ) : (
          <Empty
            description={
              cardFilter === "all"
                ? "No team members found in your hierarchy."
                : `No members match "${ROSTER_CARD_FILTER_LABELS[cardFilter]}".`
            }
          />
        )}
      </Card>

      <Drawer
        title="Team Member Details"
        placement="right"
        size={480}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
      >
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="!bg-[#fbb33b] text-white font-bold" size={64}>
                {getNameInitials(selectedMember.name)}
              </Avatar>
              <div>
                <Title level={4} className="!mb-1">
                  {selectedMember.name}
                </Title>
                <p className="text-gray-500">{selectedMember.employeeId}</p>
              </div>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Job Title">{selectedMember.role}</Descriptions.Item>
              <Descriptions.Item label="Department">
                {selectedMember.department}
              </Descriptions.Item>
              <Descriptions.Item label="Sub Department">
                {selectedMember.subDepartment || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Reporting Manager">
                {selectedMember.manager}
              </Descriptions.Item>
              <Descriptions.Item label="HOD">{selectedMember.hod}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedMember.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedMember.phone}</Descriptions.Item>
              <Descriptions.Item label="Employment Status">
                <Tag
                  color={
                    selectedMember.status.toLowerCase() === "active" ? "green" : "orange"
                  }
                >
                  {selectedMember.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="This Week's Hours">
                <span className="font-semibold">{selectedMember.hours}h</span>
              </Descriptions.Item>
              <Descriptions.Item label="Utilization">
                <span
                  className={
                    selectedMember.utilization > 100
                      ? "text-orange-500 font-semibold"
                      : "text-green-600 font-semibold"
                  }
                >
                  {selectedMember.utilization}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Timesheet Status">
                <Tag
                  color={selectedMember.timesheetStatus === "Submitted" ? "green" : "orange"}
                >
                  {selectedMember.timesheetStatus}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
}
