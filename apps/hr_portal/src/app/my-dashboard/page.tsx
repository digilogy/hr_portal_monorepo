"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  Row,
  Typography,
  Button,
  Tag,
  Spin,
  Empty,
  Alert,
  Table,
  Avatar,
  Space,
  Segmented,
} from "antd";
import {
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  UserOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildRecentWeekActivity } from "@/lib/timesheetActivity";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import {
  canAccessPersonalDashboard,
  canAccessTeam,
  getDisplayFirstName,
  getNameInitials,
  getTokenRole,
} from "@/lib/auth";

const { Title, Text } = Typography;

interface EmployeeProfile {
  name: string;
  employeeId: string;
  department: string;
  jobTitle: string;
  alsoManager?: boolean;
}

interface TimesheetRecord {
  date: string;
  totalHours: number;
  slots: Array<{
    task?: string;
    timeSlot?: string;
    title?: string;
    taskType?: string;
  }>;
}

interface TeamMemberNode {
  key: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  subDepartment: string;
  status: string;
  hours: number;
  utilization: number;
  timesheetStatus: "Submitted" | "Pending";
  children?: TeamMemberNode[];
}

interface AttentionMemberRow {
  tableRowKey: string;
  key: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  subDepartment: string;
  status: string;
  hours: number;
  utilization: number;
  timesheetStatus: "Submitted" | "Pending";
}

function normalizeIdentityValue(value?: string): string {
  return (value || "").trim();
}

function getMemberIdentity(member: TeamMemberNode): string {
  const employeeId = normalizeIdentityValue(member.employeeId);
  const email = normalizeIdentityValue(member.email).toLowerCase();
  const name = normalizeIdentityValue(member.name).toLowerCase().replace(/\s+/g, " ");

  if (employeeId && employeeId !== "—") return employeeId;
  if (email && email !== "—") return email;
  if (name && name !== "—") return `name:${name}`;
  return normalizeIdentityValue(member.key) || `row:${member.name}`;
}

function flattenTeamMembers(nodes: TeamMemberNode[]): TeamMemberNode[] {
  const seen = new Set<string>();
  const result: TeamMemberNode[] = [];

  const visit = (nodeList: TeamMemberNode[]) => {
    for (const node of nodeList) {
      const identity = getMemberIdentity(node);
      if (!seen.has(identity)) {
        seen.add(identity);
        result.push(node);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };

  visit(nodes);
  return result;
}

interface TeamResponse {
  members: TeamMemberNode[];
  summary: {
    totalMembers: number;
    submittedCount: number;
    avgUtilization: number;
  };
}

interface MetricCardProps {
  title: string;
  valueLabel: string;
  targetLabel: string;
  percent: number;
  footerLeft: string;
  footerRight: string;
  icon: React.ReactNode;
  iconClassName: string;
  barClassName: string;
  percentClassName: string;
}

function getWorkingDays(from: dayjs.Dayjs, to: dayjs.Dayjs): number {
  let count = 0;
  let current = from.startOf("day");
  const end = to.startOf("day");

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const day = current.day();
    if (day !== 0) count += 1;
    current = current.add(1, "day");
  }

  return count;
}

function getWeekdayDates(from: dayjs.Dayjs, to: dayjs.Dayjs): string[] {
  const dates: string[] = [];
  let current = from.startOf("day");
  const end = to.startOf("day");

  while (current.isBefore(end) || current.isSame(end, "day")) {
    const day = current.day();
    if (day !== 0) {
      dates.push(current.format("YYYY-MM-DD"));
    }
    current = current.add(1, "day");
  }

  return dates;
}

function MetricCard({
  title,
  valueLabel,
  targetLabel,
  percent,
  footerLeft,
  footerRight,
  icon,
  iconClassName,
  barClassName,
  percentClassName,
}: MetricCardProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <Card
      variant="borderless"
      className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 h-full"
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <Text className="text-sm text-gray-500">{title}</Text>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${iconClassName}`}
        >
          {icon}
        </div>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{valueLabel}</span>
        <span className="ml-1 text-sm text-gray-400">{targetLabel}</span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-zinc-800 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barClassName}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{footerLeft}</span>
        <span className={`font-semibold ${percentClassName}`}>{footerRight}</span>
      </div>
    </Card>
  );
}

export default function MyDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [todayEntry, setTodayEntry] = useState<TimesheetRecord | null>(null);
  const [weekEntries, setWeekEntries] = useState<TimesheetRecord[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimesheetRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberNode[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamResponse["summary"] | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<"personal" | "team">("personal");
  const [userRole, setUserRole] = useState<ReturnType<typeof getTokenRole>>(null);

  const today = dayjs();
  const weekStart = today.startOf("week");
  const monthStart = today.startOf("month");
  const monthEnd = today.endOf("month");
  const weekFrom = weekStart.format("YYYY-MM-DD");
  const weekTo = today.format("YYYY-MM-DD");
  const monthFrom = monthStart.format("YYYY-MM-DD");
  const monthTo = today.format("YYYY-MM-DD");
  const todayStr = today.format("YYYY-MM-DD");

  useEffect(() => {
    const role = getTokenRole();
    setUserRole(role);
    if (!canAccessPersonalDashboard(role)) {
      router.replace(role === "admin" ? "/dashboard" : "/timesheet");
      return;
    }

    const managerView = canAccessTeam(role);
    setIsManager(managerView);

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      setTeamError(null);

      try {
        const personalRequests: [
          Promise<{ profile: EmployeeProfile }>,
          Promise<TimesheetRecord | null>,
          Promise<TimesheetRecord[]>,
          Promise<TimesheetRecord[]>,
        ] = [
          apiFetch<{ profile: EmployeeProfile }>("/api/profile/me"),
          apiFetch<TimesheetRecord | null>(`/api/timesheets/day/${todayStr}`).catch(
            () => null,
          ),
          apiFetch<TimesheetRecord[]>(
            `/api/timesheets/history?fromDate=${weekFrom}&toDate=${weekTo}`,
          ),
          apiFetch<TimesheetRecord[]>(
            `/api/timesheets/history?fromDate=${monthFrom}&toDate=${monthTo}`,
          ),
        ];

        const teamRequest = managerView
          ? apiFetch<TeamResponse>(
              `/api/team/roster?fromDate=${weekFrom}&toDate=${weekTo}`,
            ).catch((err: unknown) => {
              setTeamError(
                err instanceof Error ? err.message : "Failed to load team overview",
              );
              return null;
            })
          : Promise.resolve(null);

        const [profileRes, todayRes, weekRes, monthRes, teamRes] = await Promise.all([
          ...personalRequests,
          teamRequest,
        ]);

        setProfile(profileRes.profile);
        setTodayEntry(todayRes);
        setWeekEntries(weekRes);
        setMonthEntries(monthRes);

        if (teamRes) {
          setTeamMembers(teamRes.members);
          setTeamSummary(teamRes.summary);
        } else if (!managerView) {
          setTeamMembers([]);
          setTeamSummary(null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [router, todayStr, weekFrom, weekTo, monthFrom, monthTo]);

  const stats = useMemo(() => {
    const todayHours = todayEntry?.totalHours ?? 0;
    const todayTarget = 8.5;

    const weekHours = weekEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
    const weekWorkingDays = getWorkingDays(weekStart, weekStart.endOf("week"));
    const weekTarget = weekWorkingDays * 8.5;

    const monthHours = monthEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
    const monthWorkingDays = getWorkingDays(monthStart, monthEnd);
    const monthTarget = monthWorkingDays * 8.5;

    const loggedDates = new Set(
      weekEntries.filter((entry) => entry.totalHours > 0).map((entry) => entry.date),
    );
    const weekDates = getWeekdayDates(weekStart, today);
    const pendingDates = weekDates.filter((date) => !loggedDates.has(date));
    const pendingCount = pendingDates.length;
    const todayPending = !todayEntry?.totalHours;

    const todayPercent = (todayHours / todayTarget) * 100;
    const weekPercent = weekTarget > 0 ? (weekHours / weekTarget) * 100 : 0;
    const monthPercent = monthTarget > 0 ? (monthHours / monthTarget) * 100 : 0;
    const pendingPercent =
      weekDates.length > 0
        ? ((weekDates.length - pendingCount) / weekDates.length) * 100
        : 100;

    return {
      todayHours,
      todayTarget,
      todayPercent,
      weekHours: parseFloat(weekHours.toFixed(1)),
      weekTarget,
      weekPercent,
      monthHours: parseFloat(monthHours.toFixed(1)),
      monthTarget,
      monthPercent,
      pendingCount,
      todayPending,
      pendingPercent,
      weekOnTrack: weekPercent >= 80,
    };
  }, [todayEntry, weekEntries, monthEntries, weekStart, monthStart, monthEnd, today]);

  const recentActivity = useMemo(
    () => buildRecentWeekActivity(weekEntries, weekStart, today, 5),
    [weekEntries, weekStart, today],
  );

  const flatTeamMembers = useMemo(
    () => flattenTeamMembers(teamMembers),
    [teamMembers],
  );

  const teamStats = useMemo(() => {
    const total = teamSummary?.totalMembers ?? 0;
    const submitted = teamSummary?.submittedCount ?? 0;
    const pending = Math.max(0, total - submitted);
    const submissionRate = total > 0 ? (submitted / total) * 100 : 0;
    const utilization = teamSummary?.avgUtilization ?? 0;
    const activeCount = flatTeamMembers.filter(
      (member) => member.status.toLowerCase() === "active",
    ).length;
    const activeRate = total > 0 ? (activeCount / total) * 100 : 0;

    return {
      total,
      submitted,
      pending,
      submissionRate,
      utilization,
      activeCount,
      activeRate,
      onTrack: utilization >= 90,
    };
  }, [teamSummary, flatTeamMembers]);

  const attentionMembers = useMemo((): AttentionMemberRow[] => {
    const byIdentity = new Map<string, TeamMemberNode>();

    for (const member of flatTeamMembers) {
      if (member.status.toLowerCase() !== "active") continue;
      if (member.timesheetStatus !== "Pending" && member.utilization >= 50) continue;

      const identity = getMemberIdentity(member);
      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, member);
      }
    }

    return [...byIdentity.values()]
      .sort((a, b) => {
        if (a.timesheetStatus !== b.timesheetStatus) {
          return a.timesheetStatus === "Pending" ? -1 : 1;
        }
        return a.utilization - b.utilization;
      })
      .map((member, index) => {
        const identity = getMemberIdentity(member);
        return {
          tableRowKey: `${identity}-${index}`,
          key: member.key,
          employeeId: member.employeeId,
          name: member.name,
          email: member.email,
          role: member.role,
          department: member.department,
          subDepartment: member.subDepartment,
          status: member.status,
          hours: member.hours,
          utilization: member.utilization,
          timesheetStatus: member.timesheetStatus,
        };
      });
  }, [flatTeamMembers]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title level={2} className="!mb-1 text-xl md:text-3xl">
            My Dashboard
          </Title>
          <p className="text-gray-500 text-sm md:text-base m-0">
            {profile
              ? `Welcome back, ${getDisplayFirstName(profile.name)} · ${profile.department}`
              : "Your personal timesheet summary"}
          </p>
        </div>
        <Link href="/timesheet">
          <Button type="primary" icon={<ArrowRightOutlined />} iconPlacement="end">
            Log Today&apos;s Timesheet
          </Button>
        </Link>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {isManager && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Segmented
            block
            className="max-w-md"
            value={dashboardView}
            onChange={(value) => setDashboardView(value as "personal" | "team")}
            options={[
              { label: "My Timesheet", value: "personal" },
              {
                label:
                  teamStats.pending > 0
                    ? `Team Overview (${teamStats.pending})`
                    : "Team Overview",
                value: "team",
              },
            ]}
          />
          {dashboardView === "team" && (
            <Link href="/my-team">
              <Button type="link" icon={<ArrowRightOutlined />} iconPlacement="end" className="!px-0">
                View Full Team
              </Button>
            </Link>
          )}
        </div>
      )}

      {(dashboardView === "personal" || !isManager) && (
        <>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Today's Hours"
            valueLabel={(() => {
              const h = Math.floor(stats.todayHours);
              const m = Math.round((stats.todayHours - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()}
            targetLabel={`/ ${(() => {
              const h = Math.floor(stats.todayTarget);
              const m = Math.round((stats.todayTarget - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()} Target`}
            percent={stats.todayPercent}
            footerLeft="Target: 8hrs 30mins"
            footerRight={`${Math.round(stats.todayPercent)}%`}
            icon={<ClockCircleOutlined />}
            iconClassName="bg-blue-50 text-blue-500"
            barClassName="bg-blue-500"
            percentClassName="text-blue-500"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Weekly Hours"
            valueLabel={(() => {
              const h = Math.floor(stats.weekHours);
              const m = Math.round((stats.weekHours - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()}
            targetLabel={`/ ${(() => {
              const h = Math.floor(stats.weekTarget);
              const m = Math.round((stats.weekTarget - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()} Target`}
            percent={stats.weekPercent}
            footerLeft={stats.weekOnTrack ? "On Track" : "Behind Target"}
            footerRight={`${Math.round(stats.weekPercent)}%`}
            icon={<CheckCircleOutlined />}
            iconClassName="bg-green-50 text-green-500"
            barClassName="bg-green-500"
            percentClassName="text-green-500"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Monthly Hours"
            valueLabel={(() => {
              const h = Math.floor(stats.monthHours);
              const m = Math.round((stats.monthHours - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()}
            targetLabel={`/ ${(() => {
              const h = Math.floor(stats.monthTarget);
              const m = Math.round((stats.monthTarget - h) * 60);
              if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
              if (h > 0) return `${h}hrs`;
              if (m > 0) return `${m}mins`;
              return "0hrs";
            })()} Target`}
            percent={stats.monthPercent}
            footerLeft={`${today.format("MMMM")} Cycle`}
            footerRight={`${Math.round(stats.monthPercent)}%`}
            icon={<CalendarOutlined />}
            iconClassName="bg-cyan-50 text-cyan-500"
            barClassName="bg-cyan-500"
            percentClassName="text-cyan-500"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Pending Submissions"
            valueLabel={String(stats.pendingCount)}
            targetLabel={stats.pendingCount === 1 ? "Day" : "Days"}
            percent={stats.pendingPercent}
            footerLeft={stats.pendingCount > 0 ? "Action Required" : "All Clear"}
            footerRight={stats.todayPending ? "Today" : "Up to date"}
            icon={<ExclamationCircleOutlined />}
            iconClassName="bg-amber-50 text-amber-500"
            barClassName="bg-amber-500"
            percentClassName="text-amber-500"
          />
        </Col>
      </Row>

      <RecentActivityCard activities={recentActivity} />
        </>
      )}

      {isManager && dashboardView === "team" && (
        <>
          <Text className="text-sm text-gray-500 block -mt-2">
            {userRole === "hrbp"
              ? `${profile?.alsoManager ? "HR portfolio & team" : "HR portfolio"} snapshot for this week (${weekFrom} – ${weekTo})`
              : `Downline snapshot for this week (${weekFrom} – ${weekTo})`}
          </Text>

          {teamError && <Alert type="warning" message={teamError} showIcon />}

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <MetricCard
                title="Total Team Members"
                valueLabel={String(teamStats.total)}
                targetLabel="members"
                percent={teamStats.activeRate}
                footerLeft={`${teamStats.activeCount} active`}
                footerRight={`${Math.round(teamStats.activeRate)}%`}
                icon={<UserOutlined />}
                iconClassName="bg-blue-50 text-blue-500"
                barClassName="bg-blue-500"
                percentClassName="text-blue-500"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <MetricCard
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
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <MetricCard
                title="Pending Timesheets"
                valueLabel={String(teamStats.pending)}
                targetLabel={teamStats.pending === 1 ? "member" : "members"}
                percent={
                  teamStats.total > 0
                    ? (teamStats.pending / teamStats.total) * 100
                    : 0
                }
                footerLeft={
                  teamStats.pending > 0 ? "Action Required" : "All Submitted"
                }
                footerRight={
                  teamStats.pending > 0
                    ? `${Math.round((teamStats.pending / Math.max(teamStats.total, 1)) * 100)}%`
                    : "0%"
                }
                icon={<ExclamationCircleOutlined />}
                iconClassName="bg-amber-50 text-amber-500"
                barClassName="bg-amber-500"
                percentClassName="text-amber-500"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <MetricCard
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
              />
            </Col>
          </Row>

          <Card
            title="Needs Attention"
            className="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800"
            variant="borderless"
            extra={
              attentionMembers.length > 0 ? (
                <Tag color="orange">{attentionMembers.length} need attention</Tag>
              ) : (
                <Tag color="green">All clear</Tag>
              )
            }
          >
            <Text className="text-sm text-gray-500 block mb-4">
              {attentionMembers.length} active{" "}
              {userRole === "hrbp" ? "assigned employees" : "downline"} with pending
              timesheets or utilization below 50%
            </Text>
            {attentionMembers.length > 0 ? (
              <Table<AttentionMemberRow>
                dataSource={attentionMembers}
                rowKey="tableRowKey"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => `${total} members`,
                }}
                size="middle"
                scroll={{ x: 640 }}
                columns={[
                  {
                    title: "Name",
                    dataIndex: "name",
                    key: "name",
                    render: (text: string) => (
                      <Space>
                        <Avatar className="!bg-[#fbb33b] text-white font-bold" size="small">
                          {getNameInitials(text)}
                        </Avatar>
                        <span className="font-medium">{text}</span>
                      </Space>
                    ),
                  },
                  {
                    title: "Department",
                    dataIndex: "department",
                    key: "department",
                    ellipsis: true,
                  },
                  {
                    title: "Hours",
                    dataIndex: "hours",
                    key: "hours",
                    render: (val: number) => <span className="font-semibold">{val}h</span>,
                  },
                  {
                    title: "Utilization",
                    dataIndex: "utilization",
                    key: "utilization",
                    render: (val: number) => (
                      <Tag color={val >= 50 ? "blue" : "red"}>{val}%</Tag>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "timesheetStatus",
                    key: "timesheetStatus",
                    render: (status: string) => (
                      <Tag color={status === "Submitted" ? "green" : "orange"}>
                        {status}
                      </Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="No team members need attention this week." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
