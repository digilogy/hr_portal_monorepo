import { EmployeeData, UserRole } from "@hr-portal/database";
import { AccessService } from "../access/access.service";
import {
  ReportFilters,
  buildReportFilterOptions,
  filterEmployeesByReportFilters,
  DEFAULT_REPORT_FILTERS,
} from "./reportFilters";
import { teamReportsRepository, TimesheetHoursStats } from "./teamReports.repository";
import { inferTaskCategory } from "./taskCategorizer";
import { getTimesheetTaskExportRows, buildExcelBuffer, buildPdfBuffer } from "./teamReports.export";

export interface TeamMemberNode {
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

export type RosterCardFilter =
  | "all"
  | "active"
  | "Submitted"
  | "Pending"
  | "on_track"
  | "needs_attention";

export interface PaginatedTeamRosterResult {
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

const TEAM_ROSTER_TREE_THRESHOLD = 200;

export interface UserReportRow {
  key: string;
  empId: string;
  name: string;
  department: string;
  manager: string;
  hours: number;
  utilization: number;
  status: "Submitted" | "Pending";
}

export interface PaginatedReportResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ManagerReportRow {
  key: string;
  managerName: string;
  department: string;
  teamSize: number;
  totalHours: number;
  avgUtilization: number;
  status: string;
}

export interface DepartmentReportRow {
  key: string;
  department: string;
  hod: string;
  headcount: number;
  totalHours: number;
  avgUtilization: number;
}

export interface OrganizationReportRow {
  key: string;
  period: string;
  headcount: number;
  expectedHours: number;
  loggedHours: number;
  utilization: number;
}

export interface DashboardSummary {
  totalEmployees: number;
  totalLoggedHours: number;
  avgUtilization: number;
  timesheetsSubmitted: number;
  departments: DepartmentReportRow[];
  filterOptions: {
    departments: string[];
  };
  totalSignUpUsers: number;
  signedUpUsersList?: Array<{
    employeeId: string;
    name: string;
    email: string;
    department: string;
  }>;
}

export interface WorkforcePulseDay {
  date: string;
  submittedCount: number;
  totalHours: number;
  rate: number;
}

export interface WorkforcePulseDayOfWeek {
  day: string;
  hours: number;
  entryCount: number;
}

export interface WorkforcePulseTaskType {
  taskType: string;
  hours: number;
  slotCount: number;
  pct: number;
}

export interface WorkforcePulseHour {
  hour: number;
  label: string;
  hours: number;
  slotCount: number;
}

export interface WorkforcePulseResult {
  employeesInScope: number;
  fromDate: string;
  toDate: string;
  summary: {
    avgDailyCompliance: number;
    peakDayOfWeek: string;
    dominantTaskType: string;
    totalLoggedHours: number;
  };
  dailyActivity: WorkforcePulseDay[];
  byDayOfWeek: WorkforcePulseDayOfWeek[];
  distribution?: Array<{
    category: string;
    hours: number;
    percentage: number;
    rate: number;
  }>;
  byTaskType: WorkforcePulseTaskType[];
  byHour: WorkforcePulseHour[];
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

function parseTimeSlotBounds(timeSlot: string): { start: number; end: number } | null {
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
  let end = parseTime(parts[1]);
  if (end < start) end += 24;
  return { start, end };
}

function distributeSlotToHourlyBuckets(
  hourStats: Map<number, { hours: number; slotCount: number }>,
  timeSlot: string,
): void {
  const bounds = parseTimeSlotBounds(timeSlot);
  if (!bounds) return;

  const { start, end } = bounds;
  if (end <= start) return;

  let hour = Math.floor(start);
  const endHour = Math.floor(end - 0.0001);

  while (hour <= endHour) {
    const hourStart = Math.max(start, hour);
    const hourEnd = Math.min(end, hour + 1);
    if (hourEnd > hourStart) {
      const bucketHour = hour % 24;
      const bucket = hourStats.get(bucketHour) ?? { hours: 0, slotCount: 0 };
      bucket.hours += hourEnd - hourStart;
      if (hour === Math.floor(start)) bucket.slotCount += 1;
      hourStats.set(bucketHour, bucket);
    }
    hour += 1;
  }
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

function buildHourlySeries(
  hourStats: Map<number, { hours: number; slotCount: number }>,
  startHour = 0,
  endHour = 23,
): WorkforcePulseHour[] {
  const result: WorkforcePulseHour[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const stats = hourStats.get(hour) ?? { hours: 0, slotCount: 0 };
    result.push({
      hour,
      label: formatHourLabel(hour),
      hours: parseFloat(stats.hours.toFixed(1)),
      slotCount: stats.slotCount,
    });
  }
  return result;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function getDefaultDateRange(fromDate?: string, toDate?: string) {
  if (fromDate && toDate) {
    return { from: fromDate, to: toDate };
  }

  const to = toDate ? parseDate(toDate) : new Date();
  const from = fromDate ? parseDate(fromDate) : startOfWeek(to);
  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

function getWorkingDays(from: string, to: string): number {
  let count = 0;
  let current = parseDate(from);
  const end = parseDate(to);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0) count++;
    current = addDays(current, 1);
  }

  return Math.max(count, 1);
}

function formatPeriodLabel(from: Date, to: Date): string {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const fromLabel = `${monthNames[from.getMonth()]} ${from.getDate()}`;
  const toLabel = `${monthNames[to.getMonth()]} ${to.getDate()}, ${to.getFullYear()}`;
  return `${fromLabel} - ${toLabel}`;
}

function normalizeGroupKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function trackLabel(labels: Map<string, number>, rawLabel: string): void {
  const trimmed = rawLabel.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed === "—") return;
  labels.set(trimmed, (labels.get(trimmed) ?? 0) + 1);
}

function pickDisplayLabel(
  labels: Map<string, number>,
  fallback: string,
): string {
  if (labels.size === 0) return fallback;
  return [...labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function buildUserRows(
  employees: EmployeeData[],
  hoursByEmail: Map<string, TimesheetHoursStats>,
  expectedHours: number,
): UserReportRow[] {
  return employees.map((employee, index) => {
    const emailKey = (employee.officialEmailId || "").toLowerCase();
    const stats = hoursByEmail.get(emailKey) ?? { hours: 0, hasEntry: false };
    const utilization =
      expectedHours > 0
        ? parseFloat(((stats.hours / expectedHours) * 100).toFixed(1))
        : 0;

    return {
      key: employee.employeeId || emailKey || `row-${index}`,
      empId: employee.employeeId || "—",
      name: employee.fullName || "—",
      department: employee.department || "—",
      manager: employee.directManagerName || "—",
      hours: parseFloat(stats.hours.toFixed(1)),
      utilization,
      status: stats.hasEntry ? "Submitted" : "Pending",
    };
  });
}

function employeeRecordScore(employee: EmployeeData): number {
  let score = 0;
  if (employee.employeeId?.trim()) score += 4;
  if (employee.officialEmailId?.trim()) score += 2;
  if (employee.directManagerEmployeeId?.trim()) score += 1;
  if (employee.fullName?.trim()) score += 1;
  return score;
}

function preferEmployeeRecord(
  candidate: EmployeeData,
  current: EmployeeData,
): EmployeeData {
  const candidateTime = candidate.updatedAt?.getTime() ?? 0;
  const currentTime = current.updatedAt?.getTime() ?? 0;
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime ? candidate : current;
  }
  return employeeRecordScore(candidate) >= employeeRecordScore(current)
    ? candidate
    : current;
}

function normalizePersonName(name?: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function preferEmployeeRecordForHierarchy(
  candidate: EmployeeData,
  current: EmployeeData,
  validManagerIds: Set<string>,
): EmployeeData {
  const candidateManager = candidate.directManagerEmployeeId?.trim();
  const currentManager = current.directManagerEmployeeId?.trim();
  const candidateValid = candidateManager
    ? validManagerIds.has(candidateManager)
    : false;
  const currentValid = currentManager ? validManagerIds.has(currentManager) : false;

  if (candidateValid !== currentValid) {
    return candidateValid ? candidate : current;
  }

  return preferEmployeeRecord(candidate, current);
}

/** Merge rows that share employee id, email, or exact full name. */
function dedupeEmployeeRecords(employees: EmployeeData[]): EmployeeData[] {
  if (employees.length === 0) return [];

  const parent = new Map<number, number>();
  for (const employee of employees) {
    parent.set(employee.id, employee.id);
  }

  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }

    let current = id;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }

    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  };

  const employeeIdIndex = new Map<string, number>();
  const emailIndex = new Map<string, number>();
  const nameIndex = new Map<string, number>();

  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    const email = employee.officialEmailId?.trim().toLowerCase();
    const name = normalizePersonName(employee.fullName);

    if (employeeId) {
      const existing = employeeIdIndex.get(employeeId);
      if (existing !== undefined) union(employee.id, existing);
      else employeeIdIndex.set(employeeId, employee.id);
    }

    if (email) {
      const existing = emailIndex.get(email);
      if (existing !== undefined) union(employee.id, existing);
      else emailIndex.set(email, employee.id);
    }

    if (name) {
      const existing = nameIndex.get(name);
      if (existing !== undefined) union(employee.id, existing);
      else nameIndex.set(name, employee.id);
    }
  }

  const validManagerIds = new Set(
    employees.map((employee) => employee.employeeId?.trim()).filter(Boolean) as string[],
  );

  const groups = new Map<number, EmployeeData[]>();
  for (const employee of employees) {
    const root = find(employee.id);
    const bucket = groups.get(root) ?? [];
    bucket.push(employee);
    groups.set(root, bucket);
  }

  return [...groups.values()].map((group) =>
    group.reduce((best, current) =>
      preferEmployeeRecordForHierarchy(current, best, validManagerIds),
    ),
  );
}

function getEmployeeIdentityKeys(employee: EmployeeData): string[] {
  const keys: string[] = [];
  const employeeId = employee.employeeId?.trim();
  const email = employee.officialEmailId?.trim().toLowerCase();
  const name = normalizePersonName(employee.fullName);

  if (employeeId) keys.push(`id:${employeeId}`);
  if (email) keys.push(`email:${email}`);
  if (name) keys.push(`name:${name}`);

  return keys.length > 0 ? keys : [`row:${employee.id}`];
}

function getEmployeeNodeKey(employee: EmployeeData): string {
  return getEmployeeIdentityKeys(employee)[0];
}

function isEmployeeAlreadyPlaced(
  employee: EmployeeData,
  placedKeys: Set<string>,
): boolean {
  return getEmployeeIdentityKeys(employee).some((key) => placedKeys.has(key));
}

function markEmployeePlaced(employee: EmployeeData, placedKeys: Set<string>): void {
  for (const key of getEmployeeIdentityKeys(employee)) {
    placedKeys.add(key);
  }
}

/** HRBP portfolios should only collapse duplicate rows for the same employee id. */
function dedupeEmployeesByEmployeeId(employees: EmployeeData[]): EmployeeData[] {
  const byEmployeeId = new Map<string, EmployeeData>();
  const withoutId: EmployeeData[] = [];

  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    if (!employeeId) {
      withoutId.push(employee);
      continue;
    }

    const existing = byEmployeeId.get(employeeId);
    byEmployeeId.set(
      employeeId,
      existing ? preferEmployeeRecord(employee, existing) : employee,
    );
  }

  return [...byEmployeeId.values(), ...withoutId];
}

function buildTeamMemberNode(
  employee: EmployeeData,
  hoursByEmail: Map<string, TimesheetHoursStats>,
  expectedHours: number,
): TeamMemberNode {
  const email = (employee.officialEmailId || "").toLowerCase();
  const stats = hoursByEmail.get(email) ?? { hours: 0, hasEntry: false };

  return {
    key: getEmployeeNodeKey(employee),
    employeeId: employee.employeeId || "—",
    name: employee.fullName || "—",
    email: employee.officialEmailId || "—",
    role: employee.jobTitle || "—",
    department: employee.department || "—",
    subDepartment: employee.subDepartment?.trim() || "—",
    manager: employee.directManagerName || "—",
    hod: employee.hodEmployeeName || "—",
    phone: employee.officeMobileNumber || "—",
    status: employee.employmentStatus || "Active",
    hours: parseFloat(stats.hours.toFixed(1)),
    utilization:
      expectedHours > 0
        ? parseFloat(((stats.hours / expectedHours) * 100).toFixed(1))
        : 0,
    timesheetStatus: stats.hasEntry ? "Submitted" : "Pending",
  };
}

function summarizeFlatTeamMembers(
  members: TeamMemberNode[],
  expectedHoursPerEmployee: number,
) {
  const submittedCount = members.filter(
    (member) => member.timesheetStatus === "Submitted",
  ).length;
  const totalHours = members.reduce((sum, member) => sum + member.hours, 0);
  const avgUtilization =
    members.length > 0 && expectedHoursPerEmployee > 0
      ? parseFloat(
          (
            (totalHours / (members.length * expectedHoursPerEmployee)) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    totalMembers: members.length,
    submittedCount,
    avgUtilization,
  };
}

function applyRosterCardFilter(
  members: TeamMemberNode[],
  rosterFilter: RosterCardFilter,
): TeamMemberNode[] {
  switch (rosterFilter) {
    case "active":
      return members.filter(
        (member) => member.status.toLowerCase() === "active",
      );
    case "Submitted":
      return members.filter((member) => member.timesheetStatus === "Submitted");
    case "Pending":
      return members.filter((member) => member.timesheetStatus === "Pending");
    case "on_track":
      return members.filter((member) => member.utilization >= 90);
    case "needs_attention":
      return members.filter((member) => member.utilization < 90);
    default:
      return members;
  }
}

function summarizeTeamMembers(
  members: TeamMemberNode[],
  expectedHoursPerEmployee: number,
) {
  const flatten = (nodes: TeamMemberNode[]): TeamMemberNode[] =>
    nodes.flatMap((node) => [
      node,
      ...(node.children ? flatten(node.children) : []),
    ]);

  const flatMembers = flatten(members);
  const submittedCount = flatMembers.filter(
    (member) => member.timesheetStatus === "Submitted",
  ).length;
  const totalHours = flatMembers.reduce((sum, member) => sum + member.hours, 0);
  const avgUtilization =
    flatMembers.length > 0 && expectedHoursPerEmployee > 0
      ? parseFloat(
          (
            (totalHours / (flatMembers.length * expectedHoursPerEmployee)) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    members,
    summary: {
      totalMembers: flatMembers.length,
      submittedCount,
      avgUtilization,
    },
  };
}

function buildTeamTree(
  employees: EmployeeData[],
  rootManagerId: string | null,
  hoursByEmail: Map<string, TimesheetHoursStats>,
  expectedHours: number,
): TeamMemberNode[] {
  const placedKeys = new Set<string>();
  const childrenByManager = new Map<string, EmployeeData[]>();

  for (const employee of employees) {
    const managerId = employee.directManagerEmployeeId?.trim() || "";
    if (!childrenByManager.has(managerId)) {
      childrenByManager.set(managerId, []);
    }
    childrenByManager.get(managerId)!.push(employee);
  }

  const buildNodes = (managerId: string): TeamMemberNode[] => {
    const reports = childrenByManager.get(managerId) ?? [];
    const nodes: TeamMemberNode[] = [];

    for (const employee of reports) {
      if (isEmployeeAlreadyPlaced(employee, placedKeys)) continue;
      markEmployeePlaced(employee, placedKeys);

      const nodeKey = getEmployeeNodeKey(employee);

      const email = (employee.officialEmailId || "").toLowerCase();
      const stats = hoursByEmail.get(email) ?? { hours: 0, hasEntry: false };
      const node: TeamMemberNode = {
        key: nodeKey,
        employeeId: employee.employeeId || "—",
        name: employee.fullName || "—",
        email: employee.officialEmailId || "—",
        role: employee.jobTitle || "—",
        department: employee.department || "—",
        subDepartment: employee.subDepartment?.trim() || "—",
        manager: employee.directManagerName || "—",
        hod: employee.hodEmployeeName || "—",
        phone: employee.officeMobileNumber || "—",
        status: employee.employmentStatus || "Active",
        hours: parseFloat(stats.hours.toFixed(1)),
        utilization:
          expectedHours > 0
            ? parseFloat(((stats.hours / expectedHours) * 100).toFixed(1))
            : 0,
        timesheetStatus: stats.hasEntry ? "Submitted" : "Pending",
      };

      const managerEmployeeId = employee.employeeId?.trim();
      if (managerEmployeeId) {
        const children = buildNodes(managerEmployeeId);
        if (children.length > 0) node.children = children;
      }

      nodes.push(node);
    }

    return nodes;
  };

  if (rootManagerId) {
    return buildNodes(rootManagerId);
  }

  const allIds = new Set(
    employees.map((employee) => employee.employeeId).filter(Boolean),
  );
  const roots = employees.filter(
    (employee) =>
      employee.employeeId &&
      (!employee.directManagerEmployeeId ||
        !allIds.has(employee.directManagerEmployeeId)),
  );

  return roots.flatMap((employee) => buildNodes(employee.employeeId!));
}

export class TeamReportsService {
  private static async getFilteredReportScopeEmployees(
    email: string,
    role: UserRole,
    filters?: ReportFilters,
  ): Promise<EmployeeData[]> {
    const employees = await AccessService.getReportScopeEmployees(email, role);
    return filterEmployeesByReportFilters(employees, filters ?? DEFAULT_REPORT_FILTERS);
  }

  static async getReportFilterOptions(email: string, role: UserRole) {
    const employees = await AccessService.getReportScopeEmployees(email, role);
    const options = buildReportFilterOptions(employees);
    return {
      departments: options.departments,
      subDepartments: options.subDepartments,
      managers: options.managers,
      employees: options.employees,
    };
  }

  static async getScopedReportFilterOptions(
    email: string,
    role: UserRole,
    filters: ReportFilters,
  ) {
    const employees = await AccessService.getReportScopeEmployees(email, role);
    const scoped = filterEmployeesByReportFilters(employees, filters);
    const options = buildReportFilterOptions(scoped);
    return {
      subDepartments: options.subDepartments,
      managers: options.managers,
      employees: options.employees,
    };
  }

  static async getTeamRoster(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
    rosterFilter: RosterCardFilter = "all",
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedTeamRosterResult> {
    const range = getDefaultDateRange(fromDate, toDate);
    const employees = await AccessService.getAccessibleEmployees(email, role);
    const currentEmployee = await AccessService.getEmployeeByEmail(email);

    let rootManagerId: string | null = null;
    if (role === UserRole.MANAGER && currentEmployee?.employeeId) {
      rootManagerId = currentEmployee.employeeId;
    }

    const excludeSelf =
      (role === UserRole.MANAGER || role === UserRole.HRBP) &&
      currentEmployee?.employeeId;

    let visibleEmployees = excludeSelf
      ? employees.filter(
          (employee) => employee.employeeId !== currentEmployee.employeeId,
        )
      : employees;

    visibleEmployees = filterEmployeesByReportFilters(
      visibleEmployees,
      filters ?? DEFAULT_REPORT_FILTERS,
    );

    const emails = visibleEmployees
      .map((employee) => employee.officialEmailId)
      .filter(Boolean) as string[];
    const hoursByEmail = await teamReportsRepository.getTimesheetHoursByEmail(
      emails,
      range.from,
      range.to,
    );

    const workingDays = getWorkingDays(range.from, range.to);
    const expectedHoursPerEmployee = workingDays * 8.5;

    const flatMembers = visibleEmployees.map((employee) =>
      buildTeamMemberNode(employee, hoursByEmail, expectedHoursPerEmployee),
    );

    const summary = summarizeFlatTeamMembers(
      flatMembers,
      expectedHoursPerEmployee,
    );

    const filteredMembers = applyRosterCardFilter(flatMembers, rosterFilter);
    const useTree =
      role === UserRole.MANAGER &&
      rosterFilter === "all" &&
      filteredMembers.length <= TEAM_ROSTER_TREE_THRESHOLD;

    if (useTree) {
      const members = buildTeamTree(
        visibleEmployees.filter((employee) =>
          filteredMembers.some(
            (member) => member.key === getEmployeeNodeKey(employee),
          ),
        ),
        rootManagerId,
        hoursByEmail,
        expectedHoursPerEmployee,
      );

      return {
        members,
        total: filteredMembers.length,
        page: 1,
        pageSize: filteredMembers.length,
        viewMode: "tree",
        summary,
      };
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const start = (safePage - 1) * safePageSize;
    const pagedMembers = filteredMembers.slice(start, start + safePageSize);

    return {
      members: pagedMembers,
      total: filteredMembers.length,
      page: safePage,
      pageSize: safePageSize,
      viewMode: "flat",
      summary,
    };
  }

  static async getUserWiseReport(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<UserReportRow[]> {
    const range = getDefaultDateRange(fromDate, toDate);
    const employees = await this.getFilteredReportScopeEmployees(
      email,
      role,
      filters,
    );
    const emails = employees
      .map((employee) => employee.officialEmailId)
      .filter(Boolean) as string[];
    const hoursByEmail = await teamReportsRepository.getTimesheetHoursByEmail(
      emails,
      range.from,
      range.to,
    );
    const workingDays = getWorkingDays(range.from, range.to);
    const expectedHours = workingDays * 8.5;

    return buildUserRows(employees, hoursByEmail, expectedHours);
  }

  static async getUserWiseReportPaginated(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    page = 1,
    pageSize = 10,
    filters?: ReportFilters,
  ): Promise<PaginatedReportResult<UserReportRow>> {
    const range = getDefaultDateRange(fromDate, toDate);
    const employees = await this.getFilteredReportScopeEmployees(
      email,
      role,
      filters,
    );
    const total = employees.length;
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const start = (safePage - 1) * safePageSize;
    const pagedEmployees = employees.slice(start, start + safePageSize);
    const emails = pagedEmployees
      .map((employee) => employee.officialEmailId)
      .filter(Boolean) as string[];
    const hoursByEmail = await teamReportsRepository.getTimesheetHoursByEmail(
      emails,
      range.from,
      range.to,
    );
    const workingDays = getWorkingDays(range.from, range.to);
    const expectedHours = workingDays * 8.5;

    return {
      rows: buildUserRows(pagedEmployees, hoursByEmail, expectedHours),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  static async getManagerWiseReport(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<ManagerReportRow[]> {
    const userRows = await this.getUserWiseReport(
      email,
      role,
      fromDate,
      toDate,
      filters,
    );
    const employees = await this.getFilteredReportScopeEmployees(
      email,
      role,
      filters,
    );
    const employeeById = new Map(
      employees
        .filter((employee) => employee.employeeId)
        .map((employee) => [employee.employeeId!, employee]),
    );

    const managerMap = new Map<
      string,
      {
        labels: Map<string, number>;
        departmentLabels: Map<string, number>;
        teamSize: number;
        totalHours: number;
        utilizations: number[];
      }
    >();

    for (const row of userRows) {
      const rawManagerName =
        row.manager && row.manager !== "—" ? row.manager : "Unassigned";
      const managerKey = normalizeGroupKey(rawManagerName);
      const employee = employeeById.get(row.empId);
      const rawDepartment =
        row.department && row.department !== "—"
          ? row.department
          : employee?.department || "Unassigned";
      const current = managerMap.get(managerKey) ?? {
        labels: new Map<string, number>(),
        departmentLabels: new Map<string, number>(),
        teamSize: 0,
        totalHours: 0,
        utilizations: [],
      };
      trackLabel(current.labels, rawManagerName);
      trackLabel(current.departmentLabels, rawDepartment);
      current.teamSize += 1;
      current.totalHours += row.hours;
      current.utilizations.push(row.utilization);
      managerMap.set(managerKey, current);
    }

    let results = [...managerMap.entries()].map(([managerKey, stats], index) => {
      const avgUtilization =
        stats.utilizations.length > 0
          ? parseFloat(
              (
                stats.utilizations.reduce((sum, value) => sum + value, 0) /
                stats.utilizations.length
              ).toFixed(1),
            )
          : 0;

      let status = "On Track";
      if (avgUtilization > 100) status = "Overutilized";
      else if (avgUtilization < 90) status = "Needs Attention";

      return {
        key: managerKey || String(index + 1),
        managerName: pickDisplayLabel(stats.labels, "Unassigned"),
        department: pickDisplayLabel(stats.departmentLabels, "Unassigned"),
        teamSize: stats.teamSize,
        totalHours: parseFloat(stats.totalHours.toFixed(1)),
        avgUtilization,
        status,
      };
    });

    if (role === UserRole.MANAGER) {
      const currentEmployee = await AccessService.getEmployeeByEmail(email);
      const selfName = currentEmployee?.fullName?.trim();
      if (selfName) {
        const selfKey = normalizeGroupKey(selfName);
        results = results.filter(
          (row) => normalizeGroupKey(row.managerName) !== selfKey,
        );
      }
    }

    return results;
  }

  static async getDepartmentWiseReport(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<DepartmentReportRow[]> {
    const userRows = await this.getUserWiseReport(
      email,
      role,
      fromDate,
      toDate,
      filters,
    );
    const employees = await this.getFilteredReportScopeEmployees(
      email,
      role,
      filters,
    );

    const deptMap = new Map<
      string,
      {
        labels: Map<string, number>;
        hodLabels: Map<string, number>;
        headcount: number;
        totalHours: number;
        utilizations: number[];
      }
    >();

    for (const row of userRows) {
      const employee = employees.find((item) => item.employeeId === row.empId);
      const rawDepartment =
        row.department && row.department !== "—" ? row.department : "Unassigned";
      const departmentKey = normalizeGroupKey(rawDepartment);
      const current = deptMap.get(departmentKey) ?? {
        labels: new Map<string, number>(),
        hodLabels: new Map<string, number>(),
        headcount: 0,
        totalHours: 0,
        utilizations: [],
      };
      trackLabel(current.labels, rawDepartment);
      if (employee?.hodEmployeeName) {
        trackLabel(current.hodLabels, employee.hodEmployeeName);
      }
      current.headcount += 1;
      current.totalHours += row.hours;
      current.utilizations.push(row.utilization);
      deptMap.set(departmentKey, current);
    }

    return [...deptMap.entries()].map(([departmentKey, stats], index) => ({
      key: departmentKey || String(index + 1),
      department: pickDisplayLabel(stats.labels, "Unassigned"),
      hod: pickDisplayLabel(stats.hodLabels, "—"),
      headcount: stats.headcount,
      totalHours: parseFloat(stats.totalHours.toFixed(1)),
      avgUtilization:
        stats.utilizations.length > 0
          ? parseFloat(
              (
                stats.utilizations.reduce((sum, value) => sum + value, 0) /
                stats.utilizations.length
              ).toFixed(1),
            )
          : 0,
    }));
  }

  static async getOrganizationWiseReport(
    email: string,
    role: UserRole,
  ): Promise<OrganizationReportRow[]> {
    if (role !== UserRole.ADMIN && !AccessService.isAdminEmail(email)) {
      return [];
    }

    const employees = await teamReportsRepository.findAllEmployees();
    const headcount = employees.length;
    const rows: OrganizationReportRow[] = [];

    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = addDays(startOfWeek(new Date()), -7 * weekOffset);
      const weekEnd = endOfWeek(weekStart);
      const from = formatDate(weekStart);
      const to = formatDate(weekEnd);
      const emails = employees
        .map((employee) => employee.officialEmailId)
        .filter(Boolean) as string[];
      const hoursByEmail = await teamReportsRepository.getTimesheetHoursByEmail(emails, from, to);
      const loggedHours = [...hoursByEmail.values()].reduce(
        (sum, stats) => sum + stats.hours,
        0,
      );
      const workingDays = getWorkingDays(from, to);
      const expectedHours = headcount * workingDays * 8.5;

      rows.push({
        key: String(weekOffset + 1),
        period: formatPeriodLabel(weekStart, weekEnd),
        headcount,
        expectedHours,
        loggedHours: parseFloat(loggedHours.toFixed(1)),
        utilization:
          expectedHours > 0
            ? parseFloat(((loggedHours / expectedHours) * 100).toFixed(1))
            : 0,
      });
    }

    return rows;
  }

  static async getDashboardSummary(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<DashboardSummary> {
    const employees = await AccessService.getAccessibleEmployees(email, role);
    const reportScopeEmployees = await AccessService.getReportScopeEmployees(
      email,
      role,
    );
    const userRows = await this.getUserWiseReport(
      email,
      role,
      fromDate,
      toDate,
      filters,
    );
    const deptRows = await this.getDepartmentWiseReport(
      email,
      role,
      fromDate,
      toDate,
      filters,
    );

    const filteredEmployees = filterEmployeesByReportFilters(
      employees,
      filters ?? DEFAULT_REPORT_FILTERS,
    );

    const filteredUserRows = userRows;

    const totalLoggedHours = filteredUserRows.reduce(
      (sum, row) => sum + row.hours,
      0,
    );
    const timesheetsSubmitted = filteredUserRows.filter(
      (row) => row.status === "Submitted",
    ).length;
    const avgUtilization =
      filteredUserRows.length > 0
        ? filteredUserRows.reduce((sum, row) => sum + row.utilization, 0) /
          filteredUserRows.length
        : 0;

    const filteredDepartments = [...deptRows].sort(
      (a, b) => b.avgUtilization - a.avgUtilization,
    );

    const emails = filteredEmployees
      .map((employee) => employee.officialEmailId?.trim().toLowerCase())
      .filter(Boolean) as string[];

    let totalSignUpUsers = 0;
    const signedUpUsersList: Array<{ employeeId: string; name: string; email: string; department: string; }> = [];
    if (emails.length > 0) {
      const usersInBatch = await teamReportsRepository.findSignedUpUsersForEmails(emails);
      totalSignUpUsers = usersInBatch.length;
      usersInBatch.forEach((u) => {
        const emp = filteredEmployees.find((e) => e.officialEmailId?.trim().toLowerCase() === u.email.toLowerCase());
        if (emp) {
          signedUpUsersList.push({
            employeeId: emp.employeeId || "-",
            name: emp.fullName || (u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.email),
            email: u.email,
            department: emp.department || "-",
          });
        }
      });
    }

    return {
      totalEmployees: filteredEmployees.length,
      totalLoggedHours: parseFloat(totalLoggedHours.toFixed(1)),
      avgUtilization: parseFloat(avgUtilization.toFixed(1)),
      timesheetsSubmitted,
      departments: filteredDepartments,
      filterOptions: buildReportFilterOptions(reportScopeEmployees),
      totalSignUpUsers,
      signedUpUsersList,
    };
  }

  private static async getReportExportSheets(
    email: string,
    role: UserRole,
    tab: string,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<{
    fileBaseName: string;
    sheets: Array<{ name: string; rows: Record<string, string | number>[] }>;
    periodLabel: string;
  }> {
    const range = getDefaultDateRange(fromDate, toDate);
    const fileSuffix = `${range.from}_to_${range.to}`;
    const periodLabel = `Period: ${range.from} to ${range.to}`;

    switch (tab) {
      case "manager": {
        const rows = await this.getManagerWiseReport(
          email,
          role,
          fromDate,
          toDate,
          filters,
        );
        return {
          fileBaseName: `manager-wise-report-${fileSuffix}`,
          periodLabel,
          sheets: [
            {
              name: "Manager-wise",
              rows: rows.map((row) => ({
                "Manager Name": row.managerName,
                Department: row.department,
                "Team Size": row.teamSize,
                "Total Logged Hours": row.totalHours,
                "Avg. Utilization (%)": row.avgUtilization,
                Status: row.status,
              })),
            },
          ],
        };
      }
      case "dept": {
        const rows = await this.getDepartmentWiseReport(
          email,
          role,
          fromDate,
          toDate,
          filters,
        );
        return {
          fileBaseName: `department-wise-report-${fileSuffix}`,
          periodLabel,
          sheets: [
            {
              name: "Department-wise",
              rows: rows.map((row) => ({
                Department: row.department,
                HOD: row.hod,
                Headcount: row.headcount,
                "Total Logged Hours": row.totalHours,
                "Avg. Utilization (%)": row.avgUtilization,
              })),
            },
          ],
        };
      }
      case "org": {
        if (role !== UserRole.ADMIN && !AccessService.isAdminEmail(email)) {
          throw new Error("Admin access only.");
        }
        const rows = await this.getOrganizationWiseReport(email, role);
        return {
          fileBaseName: `organization-wise-report-${fileSuffix}`,
          periodLabel,
          sheets: [
            {
              name: "Organization-wise",
              rows: rows.map((row) => ({
                Period: row.period,
                Headcount: row.headcount,
                "Expected Hours": row.expectedHours,
                "Logged Hours": row.loggedHours,
                "Utilization (%)": row.utilization,
              })),
            },
          ],
        };
      }
      case "user":
      default: {
        const employees = await this.getFilteredReportScopeEmployees(
          email,
          role,
          filters,
        );
        const rows = await this.getUserWiseReport(
          email,
          role,
          fromDate,
          toDate,
          filters,
        );
        const taskRows = await getTimesheetTaskExportRows(
          employees,
          range.from,
          range.to,
        );

        return {
          fileBaseName: `user-wise-report-${fileSuffix}`,
          periodLabel,
          sheets: [
            {
              name: "User-wise",
              rows: rows.map((row) => ({
                "Emp ID": row.empId,
                Employee: row.name,
                Department: row.department,
                "Reporting Manager": row.manager,
                "Logged Hours": row.hours,
                "Utilization (%)": row.utilization,
                Status: row.status,
              })),
            },
            {
              name: "Tasks",
              rows: taskRows,
            },
          ],
        };
      }
    }
  }

  static async exportExcelReport(
    email: string,
    role: UserRole,
    tab: string,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const { fileBaseName, sheets } = await this.getReportExportSheets(
      email,
      role,
      tab,
      fromDate,
      toDate,
      filters,
    );
    const [primarySheet, ...additionalSheets] = sheets;

    return {
      buffer: buildExcelBuffer(
        primarySheet.rows,
        primarySheet.name,
        additionalSheets,
      ),
      fileName: `${fileBaseName}.xlsx`,
    };
  }

  static async exportPdfReport(
    email: string,
    role: UserRole,
    tab: string,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const { fileBaseName, sheets, periodLabel } =
      await this.getReportExportSheets(
        email,
        role,
        tab,
        fromDate,
        toDate,
        filters,
      );
    const title = `${sheets[0]?.name ?? "Report"} Report`;
    const buffer = await buildPdfBuffer(title, periodLabel, sheets);

    return {
      buffer,
      fileName: `${fileBaseName}.pdf`,
    };
  }

  static async getEmployeeTimesheetDetail(
    email: string,
    role: UserRole,
    empId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const accessibleEmployees = await AccessService.getReportScopeEmployees(
      email,
      role,
    );
    const employee = accessibleEmployees.find(
      (item) => item.employeeId === empId,
    );

    if (!employee?.employeeId) {
      throw new Error("Employee not found or access denied.");
    }

    const range = getDefaultDateRange(fromDate, toDate);
    const officialEmail = employee.officialEmailId?.trim();
    const hoursByEmail = await teamReportsRepository.getTimesheetHoursByEmail(
      officialEmail ? [officialEmail] : [],
      range.from,
      range.to,
    );
    const stats = officialEmail
      ? hoursByEmail.get(officialEmail.toLowerCase()) ?? {
          hours: 0,
          hasEntry: false,
        }
      : { hours: 0, hasEntry: false };
    const workingDays = getWorkingDays(range.from, range.to);
    const expectedHours = workingDays * 8.5;

    const days: Array<{
      date: string;
      totalHours: number;
      tasks: Array<{ timeSlot: string; task: string; taskType: string }>;
    }> = [];

    if (officialEmail) {
      const user = await teamReportsRepository.findUserByEmail(officialEmail);

      if (user) {
        const entries = await teamReportsRepository.findTimesheetsForUserInRange(
          user.id,
          range.from,
          range.to,
        );

        for (const entry of entries) {
          days.push({
            date: entry.date,
            totalHours: entry.totalHours,
            tasks: entry.slots
              .filter((slot) => slot.task?.trim())
              .map((slot) => ({
                timeSlot: slot.timeSlot,
                title: slot.title || slot.taskType || "—",
                task: slot.task,
                taskType: slot.taskType || "—",
              })),
          });
        }
      }
    }

    return {
      employee: {
        empId: employee.employeeId || "—",
        name: employee.fullName || "—",
        department: employee.department || "—",
        manager: employee.directManagerName || "—",
        email: officialEmail || "—",
      },
      summary: {
        totalHours: parseFloat(stats.hours.toFixed(1)),
        expectedHours,
        utilization:
          expectedHours > 0
            ? parseFloat(((stats.hours / expectedHours) * 100).toFixed(1))
            : 0,
        status: stats.hasEntry ? ("Submitted" as const) : ("Pending" as const),
      },
      days,
    };
  }

  /** Daily compliance, weekday rhythm, and task-type mix from real timesheet slots. */
  static async getWorkforcePulse(
    email: string,
    role: UserRole,
    fromDate?: string,
    toDate?: string,
    filters?: ReportFilters,
  ): Promise<WorkforcePulseResult> {
    const range = getDefaultDateRange(fromDate, toDate);
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const emptyResult = (employeesInScope = 0): WorkforcePulseResult => ({
      employeesInScope,
      fromDate: range.from,
      toDate: range.to,
      summary: {
        avgDailyCompliance: 0,
        peakDayOfWeek: "—",
        dominantTaskType: "—",
        totalLoggedHours: 0,
      },
      dailyActivity: [],
      byDayOfWeek: [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
        day: dayLabels[dow],
        hours: 0,
        entryCount: 0,
      })),
      byTaskType: [],
      byHour: [],
    });

    if (role !== UserRole.ADMIN && !AccessService.isAdminEmail(email)) {
      return emptyResult();
    }

    const employees = await AccessService.getAccessibleEmployees(email, role);
    const filteredEmployees = filterEmployeesByReportFilters(
      employees,
      filters ?? DEFAULT_REPORT_FILTERS,
    );
    const normalizedEmails = filteredEmployees
      .map((employee) => employee.officialEmailId?.trim().toLowerCase())
      .filter(Boolean) as string[];
    const employeesInScope = filteredEmployees.length;

    if (normalizedEmails.length === 0) {
      return emptyResult(employeesInScope);
    }

    const dailyStats = new Map<string, { submittedCount: number; totalHours: number }>();
    let cursor = parseDate(range.from);
    const endDate = parseDate(range.to);
    while (cursor <= endDate) {
      dailyStats.set(formatDate(cursor), { submittedCount: 0, totalHours: 0 });
      cursor = addDays(cursor, 1);
    }

    const dowStats = new Map<number, { hours: number; entryCount: number }>();
    const taskStats = new Map<string, { hours: number; slotCount: number }>();
    const hourStats = new Map<number, { hours: number; slotCount: number }>();
    const isSingleDay = range.from === range.to;
    let totalLoggedHours = 0;

    const { dailyRows, entries } = await teamReportsRepository.getWorkforcePulseData(
      normalizedEmails,
      range.from,
      range.to,
    );

    for (const row of dailyRows) {
      const dateKey =
        typeof row.date === "string"
          ? row.date.split("T")[0]
          : formatDate(new Date(row.date));
      const existing = dailyStats.get(dateKey);
      if (!existing) continue;
      existing.submittedCount += Number(row.submittedCount);
      existing.totalHours += parseFloat(Number(row.totalHours).toFixed(1));
    }

    for (const entry of entries) {
      totalLoggedHours += entry.totalHours;
      const dow = parseDate(entry.date).getDay();
      const dowEntry = dowStats.get(dow) ?? { hours: 0, entryCount: 0 };
      dowEntry.hours += entry.totalHours;
      dowEntry.entryCount += 1;
      dowStats.set(dow, dowEntry);

      for (const slot of entry.slots) {
        if (!slot.timeSlot?.trim()) continue;
        const taskType = inferTaskCategory(slot.task, slot.taskType);
        const hours = calculateSlotHours(slot.timeSlot) ?? 0;
        const stats = taskStats.get(taskType) ?? { hours: 0, slotCount: 0 };
        stats.hours += hours;
        stats.slotCount += 1;
        taskStats.set(taskType, stats);

        if (isSingleDay && slot.timeSlot) {
          distributeSlotToHourlyBuckets(hourStats, slot.timeSlot);
        }
      }
    }

    const dailyActivity = [...dailyStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        submittedCount: stats.submittedCount,
        totalHours: parseFloat(stats.totalHours.toFixed(1)),
        rate:
          employeesInScope > 0
            ? parseFloat(
                ((stats.submittedCount / employeesInScope) * 100).toFixed(1),
              )
            : 0,
      }));

    const avgDailyCompliance =
      dailyActivity.length > 0
        ? parseFloat(
            (
              dailyActivity.reduce((sum, day) => sum + day.rate, 0) /
              dailyActivity.length
            ).toFixed(1),
          )
        : 0;

    const byDayOfWeek = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      day: dayLabels[dow],
      hours: parseFloat((dowStats.get(dow)?.hours ?? 0).toFixed(1)),
      entryCount: dowStats.get(dow)?.entryCount ?? 0,
    }));

    const peakDayOfWeek =
      byDayOfWeek.reduce(
        (best, current) => (current.hours > best.hours ? current : best),
        byDayOfWeek[0],
      )?.day ?? "—";

    const taskTotalHours = [...taskStats.values()].reduce(
      (sum, stats) => sum + stats.hours,
      0,
    );
    const byTaskType = [...taskStats.entries()]
      .map(([taskType, stats]) => ({
        taskType,
        hours: parseFloat(stats.hours.toFixed(1)),
        slotCount: stats.slotCount,
        pct:
          taskTotalHours > 0
            ? parseFloat(((stats.hours / taskTotalHours) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    const byHour = isSingleDay ? buildHourlySeries(hourStats) : [];

    return {
      employeesInScope,
      fromDate: range.from,
      toDate: range.to,
      summary: {
        avgDailyCompliance,
        peakDayOfWeek,
        dominantTaskType: byTaskType[0]?.taskType ?? "—",
        totalLoggedHours: parseFloat(totalLoggedHours.toFixed(1)),
      },
      dailyActivity,
      byDayOfWeek,
      distribution: byTaskType.map(t => ({
        category: t.taskType,
        hours: t.hours,
        percentage: t.pct,
        rate: t.pct,
      })),
      byTaskType,
      byHour,
    };
  }
}

