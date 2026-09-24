"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Avatar,
  Space,
  Segmented,
  Select,
  DatePicker,
  Modal,
} from "antd";
import {
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  UserOutlined,
  SyncOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildRecentWeekActivity } from "@/lib/timesheetActivity";
import { getSlotDurationHours } from "@/lib/timesheetSlots";
import { fmtHours } from "@/lib/formatHours";
import {
  RecentActivityCard,
  ActivityFilterType,
} from "@/components/dashboard/RecentActivityCard";

import {
  canAccessPersonalDashboard,
  canAccessTeam,
  getDisplayFirstName,
  getNameInitials,
  getTokenRole,
} from "@/lib/auth";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type PeriodKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

function startOfWeekMonday(date: Dayjs): Dayjs {
  const day = date.day();
  const diff = day === 0 ? -6 : 1 - day;
  return date.add(diff, "day").startOf("day");
}

function getPeriodRange(period: PeriodKey, customRange?: [Dayjs, Dayjs]): { from: Dayjs; to: Dayjs } {
  const today = dayjs();
  switch (period) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = today.subtract(1, "day"); return { from: y, to: y }; }
    case "this_week": return { from: startOfWeekMonday(today), to: today };
    case "last_week": {
      const s = startOfWeekMonday(today.subtract(1, "week"));
      return { from: s, to: s.add(6, "day").endOf("day") };
    }
    case "this_month": return { from: today.startOf("month"), to: today };
    case "last_month": {
      const s = today.subtract(1, "month").startOf("month");
      return { from: s, to: s.endOf("month") };
    }
    case "custom":
      return customRange ? { from: customRange[0], to: customRange[1] } : { from: startOfWeekMonday(today), to: today };
  }
}


function rangeLabel(from: Dayjs, to: Dayjs): string {
  if (from.isSame(to, "day")) return from.format("MMM D, YYYY");
  if (from.year() === to.year()) return `${from.format("MMM D")} – ${to.format("MMM D, YYYY")}`;
  return `${from.format("MMM D, YYYY")} – ${to.format("MMM D, YYYY")}`;
}

interface EmployeeProfile {
  name: string;
  employeeId: string;
  department: string;
  jobTitle: string;
  alsoManager?: boolean;
  weeklyOff?: string;
  policy?: string;
  shiftName?: string;
  allowedTimings?: string;
  preferredTiming?: string;
  halfDay?: string;
  upcomingHolidays?: any[];
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
    teamStats?: any;
    attentionMembers?: any[];
  };
}





export default function MyDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [periodEntries, setPeriodEntries] = useState<TimesheetRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberNode[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamResponse["summary"] | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<"personal" | "team">("personal");
  const [userRole, setUserRole] = useState<ReturnType<typeof getTokenRole>>(null);

  // Period & Metric Card filter
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("this_week");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | undefined>();
  const [activeCard, setActiveCard] = useState<"total" | "submission" | "avg" | "pending" | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>("all");
  const [stats, setStats] = useState<any>(null);

  const handlePeriodSelect = (period: PeriodKey) => {
    setSelectedPeriod(period);
  };

  const handleActivityFilterSelect = (filter: ActivityFilterType) => {
    setActivityFilter(filter);
  };

  const activitySectionRef = useRef<HTMLDivElement>(null);
  const [isPaceModalOpen, setIsPaceModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const today = dayjs();
  const { periodFrom, periodTo, periodFromStr, periodToStr, label } = useMemo(() => {
    const { from, to } = getPeriodRange(selectedPeriod, customRange);
    return {
      periodFrom: from,
      periodTo: to,
      periodFromStr: from.format("YYYY-MM-DD"),
      periodToStr: to.format("YYYY-MM-DD"),
      label: rangeLabel(from, to),
    };
  }, [selectedPeriod, customRange]);
  const todayStr = today.format("YYYY-MM-DD");

  const fetchPeriodData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, summaryRes] = await Promise.all([
        apiFetch<{ profile: EmployeeProfile }>("/api/profile/me"),
        apiFetch<any>(
          `/api/timesheets/my-summary?fromDate=${periodFromStr}&toDate=${periodToStr}`
        ),
      ]);
      setProfile(profileRes.profile);
      setPeriodEntries(summaryRes.entries);
      
      const rawStats = summaryRes.stats;
      setStats({
        ...rawStats,
        fullyLoggedDates: new Set(rawStats.fullyLoggedDates || []),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [periodFromStr, periodToStr]);

  useEffect(() => {
    const role = getTokenRole();
    setUserRole(role);
    if (!canAccessPersonalDashboard(role)) {
      router.replace(role === "admin" ? "/dashboard" : "/timesheet");
      return;
    }
    const managerView = canAccessTeam(role);
    setIsManager(managerView);
    void fetchPeriodData();
    setMounted(true);
    if (managerView) {
      apiFetch<TeamResponse>(`/api/team/roster?fromDate=${todayStr}&toDate=${todayStr}`)
        .then((teamRes) => { setTeamMembers(teamRes.members); setTeamSummary(teamRes.summary); })
        .catch((err: unknown) => {
          setTeamError(err instanceof Error ? err.message : "Failed to load team overview");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!mounted) return;
    void fetchPeriodData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFromStr, periodToStr]);



  // Stats are now calculated on the backend!

  const editableDays = useMemo(() => stats?.editableDays || [], [stats]);

  const recentActivity = useMemo(() => {
    if (!stats) return [];
    const activities = buildRecentWeekActivity(periodEntries, stats.elapsedWorkdaysArray, stats.weekdayDates.length);
    return activities.map((act) => ({
      ...act,
      isLogged: stats.fullyLoggedDates.has(act.date),
      isEditable: editableDays.includes(act.date),
    }));
  }, [periodEntries, stats, editableDays]);

  const flatTeamMembers = useMemo(
    () => flattenTeamMembers(teamMembers),
    [teamMembers],
  );

  const teamStats = useMemo(() => {
    return teamSummary?.teamStats || {
      total: 0,
      submitted: 0,
      pending: 0,
      submissionRate: 0,
      utilization: 0,
      activeCount: 0,
      activeRate: 0,
      onTrack: false,
    };
  }, [teamSummary]);

  const attentionMembers = useMemo((): AttentionMemberRow[] => {
    const raw = teamSummary?.attentionMembers || [];
    return raw.map((member: any, index: number) => ({
      tableRowKey: `${member.key}-${index}`,
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
    }));
  }, [teamSummary]);

  if (loading || !stats) {
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

      {error && <Alert type="error" title={error} showIcon />}

      {isManager && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Segmented
            value={dashboardView}
            onChange={(value) => setDashboardView(value as "personal" | "team")}
            options={[
              { label: "My Timesheet", value: "personal" },
              {
                label: "Team Overview",
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
          {/* ── Date Filter Bar ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm px-4 py-3 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period</span>
              <Select
                value={selectedPeriod}
                onChange={(val) => handlePeriodSelect(val as PeriodKey)}
                className="w-40"
                options={[
                  { label: "Today", value: "today" },
                  { label: "Yesterday", value: "yesterday" },
                  { label: "This Week", value: "this_week" },
                  { label: "Last Week", value: "last_week" },
                  { label: "This Month", value: "this_month" },
                  { label: "Last Month", value: "last_month" },
                  { label: "Custom", value: "custom" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date Range</span>
              <RangePicker
                value={[periodFrom, periodTo]}
                disabled={selectedPeriod !== "custom"}
                format="YYYY-MM-DD"
                disabledDate={(d) => d.isAfter(today)}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) setCustomRange([dates[0], dates[1]]);
                }}
                className="w-60"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
              />
            </div>
            {/* <div className="ml-auto flex items-center">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5">{label}</span>
            </div> */}
          </div>

          {/* ── Metric Cards ─────────────────────────────────────────── */}
          <Row gutter={[{ xs: 8, sm: 12, md: 16 }, { xs: 8, sm: 12, md: 16 }]}>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
                title="Total Logged Hours"
                valueLabel={fmtHours(stats.totalHours)}
                targetLabel={`/ ${fmtHours(stats.targetTotal)} Target`}
                percent={stats.totalPercent}
                footerLeft={stats.totalPercent >= 80 ? "On Track" : "Behind Target"}
                footerRight={`${Math.round(stats.totalPercent)}%`}
                icon={<ClockCircleOutlined />}
                iconClassName="bg-blue-50 text-blue-500"
                barClassName="bg-blue-500"
                percentClassName="text-blue-500"
              />
            </Col>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
                title="Timesheet Submission"
                valueLabel={String(stats.submittedWorkdays)}
                targetLabel={`/ ${stats.elapsedWorkdays} Workdays`}
                percent={stats.submissionPercent}
                footerLeft={`${stats.elapsedWorkdays - stats.submittedWorkdays} Days Pending`}
                footerRight={`${Math.round(stats.submissionPercent)}%`}
                icon={<CheckCircleOutlined />}
                iconClassName="bg-green-50 text-green-500"
                barClassName="bg-green-500"
                percentClassName="text-green-500"
              />
            </Col>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
                title="Avg. Daily Hours"
                valueLabel={fmtHours(stats.avgDaily)}
                targetLabel="/ day"
                percent={stats.avgPercent}
                footerLeft={`Target: ${fmtHours(stats.avgTargetDaily)} / day`}
                footerRight={`${Math.round(stats.avgPercent)}%`}
                icon={<SyncOutlined />}
                iconClassName="bg-cyan-50 text-cyan-500"
                barClassName="bg-cyan-500"
                percentClassName="text-cyan-500"
              />
            </Col>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
                title="Pending Submissions"
                valueLabel={String(stats.pendingCount)}
                targetLabel={stats.pendingCount === 1 ? "Day" : "Days"}
                percent={stats.pendingPercent}
                footerLeft={stats.pendingCount > 0 ? "Action Required" : "All Clear"}
                footerRight={
                  <Button
                    type="primary"
                    size="small"
                    icon={<EyeOutlined />}
                    className="!text-[10px] !px-2.5 !h-6 bg-[#F5A623] hover:bg-[#e0951d] text-white border-none shadow-sm font-semibold flex items-center gap-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityFilter("pending");
                      activitySectionRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    View List
                  </Button>
                }
                icon={<ExclamationCircleOutlined />}
                iconClassName="bg-amber-50 text-amber-500"
                barClassName="bg-amber-500"
                percentClassName={stats.needsLog ? "text-amber-500" : "text-green-500"}
              />
            </Col>
          </Row>

          <div ref={activitySectionRef}>
            <RecentActivityCard
              activities={recentActivity}
              periodLabel={label}
              activeFilter={activityFilter}
              onFilterChange={(f) => {
                setActivityFilter(f);
                if (f === "pending") setActiveCard("pending");
                else if (f === "logged") setActiveCard("total");
                else setActiveCard(null);
              }}
            />
          </div>

          {/* ── Avg Daily Hours Pace Breakdown Modal ───────────────── */}
          <Modal
            open={isPaceModalOpen}
            onCancel={() => {
              setIsPaceModalOpen(false);
              if (activeCard === "avg") setActiveCard(null);
            }}
            footer={null}
            title={
              <div className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                <SyncOutlined className="text-cyan-500" />
                <span>Avg. Daily Hours · Pace & Target Breakdown</span>
              </div>
            }
            width={640}
            className="rounded-2xl"
          >
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                <div>
                  <div className="text-xs text-gray-400">Daily Average</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {fmtHours(stats.avgDaily)} <span className="text-xs font-normal text-gray-400">/ day</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Target Benchmark</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {fmtHours(stats.avgTargetDaily)} <span className="text-xs font-normal text-gray-400">/ day</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Achievement Rate</div>
                  <div className={`text-lg font-bold ${stats.avgPercent >= 80 ? "text-green-500" : "text-amber-500"}`}>
                    {Math.round(stats.avgPercent)}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 rounded-lg border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between">
                <span>Calculation Formula:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {fmtHours(stats.totalHours)} logged ÷ {stats.elapsedWorkdays} workdays = {fmtHours(stats.avgDaily)} / day
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Workday Pace Breakdown ({label})
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.date}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {activity.dateLabel}
                          </span>
                          <span className="text-xs text-gray-400">{activity.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {activity.isLogged ? (
                          <>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                              {fmtHours(activity.totalHours)} / {fmtHours(stats.normalHours)}
                            </span>
                            <Tag color={activity.totalHours >= stats.normalHours ? "green" : "gold"} className="!m-0">
                              {activity.totalHours >= stats.normalHours ? "Target Met" : "Under Target"}
                            </Tag>
                          </>
                        ) : (
                          <>
                            <Tag color="volcano" className="!m-0">
                              Needs Log
                            </Tag>
                            <Link href={`/timesheet?date=${activity.date}`}>
                              <Button type="primary" size="small" className="!text-xs">
                                Log Day
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        </>
      )}


      {isManager && dashboardView === "team" && (
        <>
          <Text className="text-sm text-gray-500 block -mt-2">
            {userRole === "hrbp"
              ? `${profile?.alsoManager ? "HR portfolio & team" : "HR portfolio"} snapshot for today (${today.format("YYYY-MM-DD")})`
              : `Downline snapshot for today (${today.format("YYYY-MM-DD")})`}
          </Text>

          {teamError && <Alert type="warning" title={teamError} showIcon />}

          <Row gutter={[{ xs: 8, sm: 12, md: 16 }, { xs: 8, sm: 12, md: 16 }]}>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
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
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
                title="Timesheets Submitted"
                valueLabel={String(teamStats.submitted)}
                targetLabel={`/ ${teamStats.total}`}
                percent={teamStats.submissionRate}
                footerLeft="Today"
                footerRight={`${Math.round(teamStats.submissionRate)}%`}
                icon={<CheckCircleOutlined />}
                iconClassName="bg-green-50 text-green-500"
                barClassName="bg-green-500"
                percentClassName="text-green-500"
              />
            </Col>
            <Col xs={12} sm={12} xl={6}>
              <DashboardMetricCard
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
              <ResponsiveTable<AttentionMemberRow>
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
                    render: (val: number) => <span className="font-semibold">{fmtHours(val)}</span>,
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
              <Empty description="No team members need attention today." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
