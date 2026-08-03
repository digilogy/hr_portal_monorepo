import { EmployeeData } from "@hr-portal/database";

export interface ReportFilters {
  department: string;
  subDepartment: string;
  manager: string;
  employee: string;
}

export interface DepartmentFilter {
  department: string;
}

export interface ReportFilterEmployee {
  employeeId: string;
  name: string;
  department: string;
  subDepartment: string;
  manager: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  department: "all",
  subDepartment: "all",
  manager: "all",
  employee: "all",
};

export const DEFAULT_DEPARTMENT_FILTER: DepartmentFilter = {
  department: "all",
};

export function parseReportFilters(query: {
  department?: unknown;
  subDepartment?: unknown;
  manager?: unknown;
  employee?: unknown;
}): ReportFilters {
  return {
    department:
      typeof query.department === "string" && query.department.trim()
        ? query.department.trim()
        : "all",
    subDepartment:
      typeof query.subDepartment === "string" && query.subDepartment.trim()
        ? query.subDepartment.trim()
        : "all",
    manager:
      typeof query.manager === "string" && query.manager.trim()
        ? query.manager.trim()
        : "all",
    employee:
      typeof query.employee === "string" && query.employee.trim()
        ? query.employee.trim()
        : "all",
  };
}

export function parseDepartmentFilter(query: {
  department?: unknown;
}): DepartmentFilter {
  return {
    department:
      typeof query.department === "string" && query.department.trim()
        ? query.department.trim()
        : "all",
  };
}

export function hasActiveReportFilters(filters: ReportFilters): boolean {
  return (
    filters.department !== "all" ||
    filters.subDepartment !== "all" ||
    filters.manager !== "all" ||
    filters.employee !== "all"
  );
}

export function hasActiveDepartmentFilter(filters: DepartmentFilter): boolean {
  return filters.department !== "all";
}

function normalizeFilterValue(value?: string | null, fallback = "Unassigned"): string {
  return value?.trim().replace(/\s+/g, " ") || fallback;
}

export function filterFieldKey(value?: string | null): string {
  return normalizeFilterValue(value).toLowerCase();
}

export function departmentFilterKey(value?: string | null): string {
  return filterFieldKey(value);
}

function pickPreferredLabel(labels: Map<string, number>): string {
  return [...labels.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0][0];
}

function buildDedupedFilterOptions(
  employees: EmployeeData[],
  getValue: (employee: EmployeeData) => string | null | undefined,
): string[] {
  const byKey = new Map<string, Map<string, number>>();

  for (const employee of employees) {
    const label = normalizeFilterValue(getValue(employee));
    const key = filterFieldKey(label);
    const counts = byKey.get(key) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    byKey.set(key, counts);
  }

  return [...byKey.values()]
    .map(pickPreferredLabel)
    .sort((a, b) => a.localeCompare(b));
}

function buildDedupedOptionsFromRecords(
  records: ReportFilterEmployee[],
  getValue: (record: ReportFilterEmployee) => string,
): string[] {
  const byKey = new Map<string, Map<string, number>>();

  for (const record of records) {
    const label = normalizeFilterValue(getValue(record));
    const key = filterFieldKey(label);
    const counts = byKey.get(key) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    byKey.set(key, counts);
  }

  return [...byKey.values()]
    .map(pickPreferredLabel)
    .sort((a, b) => a.localeCompare(b));
}

export function buildDepartmentFilterOptions(employees: EmployeeData[]): string[] {
  return buildDedupedFilterOptions(employees, (employee) => employee.department);
}

export function buildReportFilterEmployeeRecords(
  employees: EmployeeData[],
): ReportFilterEmployee[] {
  const byEmployeeId = new Map<string, ReportFilterEmployee>();

  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    if (!employeeId) continue;

    const record: ReportFilterEmployee = {
      employeeId,
      name: normalizeFilterValue(employee.fullName, "Unnamed"),
      department: normalizeFilterValue(employee.department),
      subDepartment: normalizeFilterValue(employee.subDepartment),
      manager: normalizeFilterValue(employee.directManagerName),
    };

    if (!byEmployeeId.has(employeeId)) {
      byEmployeeId.set(employeeId, record);
    }
  }

  return [...byEmployeeId.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function fieldMatchesFilter(
  value: string | null | undefined,
  filterValue: string,
): boolean {
  if (filterValue === "all") {
    return true;
  }

  return filterFieldKey(value) === filterFieldKey(filterValue);
}

export function employeeMatchesReportFilters(
  employee: EmployeeData,
  filters: ReportFilters,
): boolean {
  if (!fieldMatchesFilter(employee.department, filters.department)) {
    return false;
  }

  if (!fieldMatchesFilter(employee.subDepartment, filters.subDepartment)) {
    return false;
  }

  if (!fieldMatchesFilter(employee.directManagerName, filters.manager)) {
    return false;
  }

  if (filters.employee !== "all") {
    const employeeId = employee.employeeId?.trim();
    if (!employeeId || employeeId !== filters.employee) {
      return false;
    }
  }

  return true;
}

export function employeeMatchesDepartmentFilter(
  employee: EmployeeData,
  filters: DepartmentFilter,
): boolean {
  return fieldMatchesFilter(employee.department, filters.department);
}

export function filterEmployeesByReportFilters(
  employees: EmployeeData[],
  filters: ReportFilters,
): EmployeeData[] {
  if (!hasActiveReportFilters(filters)) {
    return employees;
  }

  return employees.filter((employee) =>
    employeeMatchesReportFilters(employee, filters),
  );
}

export function filterEmployeesByDepartmentFilter(
  employees: EmployeeData[],
  filters: DepartmentFilter,
): EmployeeData[] {
  if (!hasActiveDepartmentFilter(filters)) {
    return employees;
  }

  return employees.filter((employee) =>
    employeeMatchesDepartmentFilter(employee, filters),
  );
}

export function scopeReportFilterEmployees(
  records: ReportFilterEmployee[],
  filters: Pick<ReportFilters, "department" | "subDepartment" | "manager">,
): ReportFilterEmployee[] {
  return records.filter((record) => {
    if (!fieldMatchesFilter(record.department, filters.department)) {
      return false;
    }

    if (!fieldMatchesFilter(record.subDepartment, filters.subDepartment)) {
      return false;
    }

    if (!fieldMatchesFilter(record.manager, filters.manager)) {
      return false;
    }

    return true;
  });
}

export function buildCascadedReportFilterOptions(
  records: ReportFilterEmployee[],
  filters: Pick<ReportFilters, "department" | "subDepartment" | "manager">,
): {
  subDepartments: string[];
  managers: string[];
  employees: Array<{ employeeId: string; label: string }>;
} {
  const departmentScoped = scopeReportFilterEmployees(records, {
    department: filters.department,
    subDepartment: "all",
    manager: "all",
  });

  const subDepartmentScoped = scopeReportFilterEmployees(records, {
    department: filters.department,
    subDepartment: filters.subDepartment,
    manager: "all",
  });

  const fullyScoped = scopeReportFilterEmployees(records, filters);

  return {
    subDepartments: buildDedupedOptionsFromRecords(
      departmentScoped,
      (record) => record.subDepartment,
    ),
    managers: buildDedupedOptionsFromRecords(
      subDepartmentScoped.length > 0 ? subDepartmentScoped : departmentScoped,
      (record) => record.manager,
    ),
    employees: fullyScoped.map((record) => ({
      employeeId: record.employeeId,
      label: `${record.name} (${record.employeeId})`,
    })),
  };
}

export function buildReportFilterOptions(employees: EmployeeData[]): {
  departments: string[];
  subDepartments: string[];
  managers: string[];
  employees: ReportFilterEmployee[];
} {
  const records = buildReportFilterEmployeeRecords(employees);

  return {
    departments: buildDepartmentFilterOptions(employees),
    subDepartments: buildDedupedOptionsFromRecords(
      records,
      (record) => record.subDepartment,
    ),
    managers: buildDedupedOptionsFromRecords(records, (record) => record.manager),
    employees: records,
  };
}

export function teamMemberMatchesReportFilters(
  member: {
    employeeId?: string;
    department?: string;
    subDepartment?: string;
    manager?: string;
  },
  filters: ReportFilters,
): boolean {
  if (!fieldMatchesFilter(member.department, filters.department)) {
    return false;
  }

  if (!fieldMatchesFilter(member.subDepartment, filters.subDepartment)) {
    return false;
  }

  if (!fieldMatchesFilter(member.manager, filters.manager)) {
    return false;
  }

  if (filters.employee !== "all") {
    const employeeId = member.employeeId?.trim();
    if (!employeeId || employeeId !== filters.employee) {
      return false;
    }
  }

  return true;
}

export function teamMemberMatchesDepartmentFilter(
  member: {
    department?: string;
  },
  filters: DepartmentFilter,
): boolean {
  return fieldMatchesFilter(member.department, filters.department);
}

export function sanitizeReportFilters(
  filters: ReportFilters,
  records: ReportFilterEmployee[],
): ReportFilters {
  const cascaded = buildCascadedReportFilterOptions(records, filters);
  let next = { ...filters };

  if (
    next.subDepartment !== "all" &&
    !cascaded.subDepartments.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.subDepartment),
    )
  ) {
    next = { ...next, subDepartment: "all" };
  }

  const refreshed = buildCascadedReportFilterOptions(records, next);

  if (
    next.manager !== "all" &&
    !refreshed.managers.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.manager),
    )
  ) {
    next = { ...next, manager: "all" };
  }

  const refreshedAgain = buildCascadedReportFilterOptions(records, next);

  if (
    next.employee !== "all" &&
    !refreshedAgain.employees.some(
      (value) => value.employeeId === next.employee,
    )
  ) {
    next = { ...next, employee: "all" };
  }

  return next;
}
