export interface ReportFilterEmployee {
  employeeId: string;
  name: string;
  department: string;
  subDepartment: string;
  hod: string;
  hrbp: string;
  manager: string;
}

export interface ReportFilterOptions {
  departments: string[];
  subDepartments: string[];
  hods: string[];
  hrbps: string[];
  managers: string[];
  employees?: ReportFilterEmployee[];
}

export interface ScopedReportFilterOptions {
  subDepartments: string[];
  hods: string[];
  hrbps: string[];
  managers: string[];
  employees: ReportFilterEmployee[];
}

export interface DepartmentFilterOptions {
  departments: string[];
}

export interface ReportFilters {
  department: string;
  subDepartment: string;
  hod: string;
  hrbp: string;
  manager: string;
  employee: string;
  status: string;
}

export interface DepartmentFilter {
  department: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  department: "all",
  subDepartment: "all",
  hod: "all",
  hrbp: "all",
  manager: "all",
  employee: "all",
  status: "all",
};

export const DEFAULT_DEPARTMENT_FILTER: DepartmentFilter = {
  department: "all",
};

export function appendReportFilters(
  params: URLSearchParams,
  filters: ReportFilters,
): URLSearchParams {
  if (filters.department !== "all") {
    params.set("department", filters.department);
  }
  if (filters.subDepartment !== "all") {
    params.set("subDepartment", filters.subDepartment);
  }
  if (filters.hod !== "all") {
    params.set("hod", filters.hod);
  }
  if (filters.hrbp !== "all") {
    params.set("hrbp", filters.hrbp);
  }
  if (filters.manager !== "all") {
    params.set("manager", filters.manager);
  }
  if (filters.employee !== "all") {
    params.set("employee", filters.employee);
  }
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  return params;
}

export function appendDepartmentFilter(
  params: URLSearchParams,
  filters: DepartmentFilter,
): URLSearchParams {
  if (filters.department !== "all") {
    params.set("department", filters.department);
  }
  return params;
}

export function parseReportFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ReportFilters {
  return {
    department: searchParams.get("department")?.trim() || "all",
    subDepartment: searchParams.get("subDepartment")?.trim() || "all",
    hod: searchParams.get("hod")?.trim() || "all",
    hrbp: searchParams.get("hrbp")?.trim() || "all",
    manager: searchParams.get("manager")?.trim() || "all",
    employee: searchParams.get("employee")?.trim() || "all",
    status: searchParams.get("status")?.trim() || "all",
  };
}

export function reportFiltersToSearchParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  appendReportFilters(params, filters);
  return params;
}

export function toSelectOptions(values: string[], allLabel: string) {
  return [
    { value: "all", label: allLabel },
    ...values.map((value) => ({ value, label: value })),
  ];
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

function fieldMatchesFilter(
  value: string | null | undefined,
  filterValue: string,
): boolean {
  if (filterValue === "all") {
    return true;
  }

  return filterFieldKey(value) === filterFieldKey(filterValue);
}

export function scopeReportFilterEmployees(
  records: ReportFilterEmployee[],
  filters: Pick<ReportFilters, "department" | "subDepartment" | "hod" | "hrbp" | "manager">,
): ReportFilterEmployee[] {
  return records.filter((record) => {
    if (!fieldMatchesFilter(record.department, filters.department)) {
      return false;
    }

    if (!fieldMatchesFilter(record.subDepartment, filters.subDepartment)) {
      return false;
    }

    if (!fieldMatchesFilter(record.hod, filters.hod)) {
      return false;
    }

    if (!fieldMatchesFilter(record.hrbp, filters.hrbp)) {
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
  filters: Pick<ReportFilters, "department" | "subDepartment" | "hod" | "hrbp" | "manager">,
): {
  departments: string[];
  subDepartments: string[];
  hods: string[];
  hrbps: string[];
  managers: string[];
  employees: Array<{ employeeId: string; label: string }>;
} {
  const scopeExcept = (keyToIgnore: keyof typeof filters) => {
    return scopeReportFilterEmployees(records, {
      ...filters,
      [keyToIgnore]: "all",
    });
  };

  const fullyScoped = scopeReportFilterEmployees(records, filters);

  return {
    departments: buildDedupedOptionsFromRecords(
      scopeExcept("department"),
      (record) => record.department,
    ),
    subDepartments: buildDedupedOptionsFromRecords(
      scopeExcept("subDepartment"),
      (record) => record.subDepartment,
    ),
    hods: buildDedupedOptionsFromRecords(
      scopeExcept("hod"),
      (record) => record.hod,
    ),
    hrbps: buildDedupedOptionsFromRecords(
      scopeExcept("hrbp"),
      (record) => record.hrbp,
    ),
    managers: buildDedupedOptionsFromRecords(
      scopeExcept("manager"),
      (record) => record.manager,
    ),
    employees: fullyScoped.map((record) => ({
      employeeId: record.employeeId,
      label: `${record.name} (${record.employeeId})`,
    })),
  };
}

export function sanitizeReportFilters(
  filters: ReportFilters,
  records: ReportFilterEmployee[],
): ReportFilters {
  const cascaded = buildCascadedReportFilterOptions(records, filters);
  let next = { ...filters };

  if (
    next.department !== "all" &&
    !cascaded.departments.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.department),
    )
  ) {
    next = { ...next, department: "all" };
  }

  if (
    next.subDepartment !== "all" &&
    !cascaded.subDepartments.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.subDepartment),
    )
  ) {
    next = { ...next, subDepartment: "all" };
  }

  if (
    next.hod !== "all" &&
    !cascaded.hods.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.hod),
    )
  ) {
    next = { ...next, hod: "all" };
  }

  if (
    next.hrbp !== "all" &&
    !cascaded.hrbps.some(
      (value) => filterFieldKey(value) === filterFieldKey(next.hrbp),
    )
  ) {
    next = { ...next, hrbp: "all" };
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

export function teamMemberMatchesReportFilters(
  member: {
    employeeId?: string;
    department?: string;
    subDepartment?: string;
    hod?: string;
    hrbp?: string;
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

  if (!fieldMatchesFilter(member.hod, filters.hod)) {
    return false;
  }

  if (!fieldMatchesFilter(member.hrbp, filters.hrbp)) {
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

export function hasActiveReportFilters(filters: ReportFilters): boolean {
  return (
    filters.department !== "all" ||
    filters.subDepartment !== "all" ||
    filters.hod !== "all" ||
    filters.hrbp !== "all" ||
    filters.manager !== "all" ||
    filters.employee !== "all" ||
    filters.status !== "all"
  );
}

export function hasActiveDepartmentFilter(filters: DepartmentFilter): boolean {
  return filters.department !== "all";
}

export const caseInsensitiveFilterOption = (
  input: string,
  option?: { label?: string | number },
) =>
  String(option?.label ?? "")
    .toLowerCase()
    .includes(input.trim().toLowerCase());
