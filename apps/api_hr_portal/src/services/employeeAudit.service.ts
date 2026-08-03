import { EmployeeData } from "@hr-portal/database";

export interface EmployeeAuditRow {
  dbRowId: number;
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  managerId: string;
  managerName: string;
  status: string;
}

export interface DuplicateGroupRow extends EmployeeAuditRow {
  groupId: string;
  matchReason: string;
}

export interface OrphanRow extends EmployeeAuditRow {
  orphanReason: string;
}

export interface EmployeeAuditSummary {
  totalRawRows: number;
  uniqueAfterDedupe: number;
  duplicateExtraRows: number;
  inHierarchyCount: number;
  orphanCount: number;
  missingEmployeeIdRows: number;
  invalidManagerIdRows: number;
  rootEmployeeCount: number;
}

export interface EmployeeAuditResult {
  summary: EmployeeAuditSummary;
  duplicateGroups: DuplicateGroupRow[];
  orphans: OrphanRow[];
}

function normalizePersonName(name?: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toAuditRow(employee: EmployeeData): EmployeeAuditRow {
  return {
    dbRowId: employee.id,
    employeeId: employee.employeeId?.trim() || "—",
    fullName: employee.fullName?.trim() || "—",
    email: employee.officialEmailId?.trim() || "—",
    department: employee.department?.trim() || "—",
    managerId: employee.directManagerEmployeeId?.trim() || "—",
    managerName: employee.directManagerName?.trim() || "—",
    status: employee.employmentStatus?.trim() || "—",
  };
}

function dedupeGroups(employees: EmployeeData[]): EmployeeData[][] {
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

  const groups = new Map<number, EmployeeData[]>();
  for (const employee of employees) {
    const root = find(employee.id);
    const bucket = groups.get(root) ?? [];
    bucket.push(employee);
    groups.set(root, bucket);
  }

  return [...groups.values()];
}

function getDuplicateMatchReasons(group: EmployeeData[]): string {
  const reasons = new Set<string>();
  const employeeIds = group
    .map((employee) => employee.employeeId?.trim())
    .filter(Boolean);
  const emails = group
    .map((employee) => employee.officialEmailId?.trim().toLowerCase())
    .filter(Boolean);
  const names = group.map((employee) => normalizePersonName(employee.fullName)).filter(Boolean);

  if (new Set(employeeIds).size < employeeIds.length) reasons.add("same employee id");
  if (new Set(emails).size < emails.length) reasons.add("same email");
  if (new Set(names).size < names.length) reasons.add("same full name");

  return reasons.size > 0 ? [...reasons].join(", ") : "linked duplicate group";
}

function getReachableEmployeeIds(employees: EmployeeData[]): {
  reachable: Set<string>;
  roots: EmployeeData[];
} {
  const byId = new Map<string, EmployeeData>();
  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    if (employeeId) {
      byId.set(employeeId, employee);
    }
  }

  const allIds = new Set(byId.keys());
  const roots = [...byId.values()].filter((employee) => {
    const managerId = employee.directManagerEmployeeId?.trim();
    return !managerId || !allIds.has(managerId);
  });

  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const root of roots) {
    const rootId = root.employeeId!.trim();
    if (!reachable.has(rootId)) {
      reachable.add(rootId);
      queue.push(rootId);
    }
  }

  while (queue.length > 0) {
    const managerId = queue.shift()!;
    for (const employee of byId.values()) {
      const employeeId = employee.employeeId?.trim();
      if (!employeeId || reachable.has(employeeId)) continue;
      if (employee.directManagerEmployeeId?.trim() === managerId) {
        reachable.add(employeeId);
        queue.push(employeeId);
      }
    }
  }

  return { reachable, roots };
}

function getOrphanReason(
  employee: EmployeeData,
  allIds: Set<string>,
  reachable: Set<string>,
): string {
  const employeeId = employee.employeeId?.trim();
  if (!employeeId) {
    return "missing employee id";
  }

  const managerId = employee.directManagerEmployeeId?.trim();
  if (managerId && !allIds.has(managerId)) {
    return "invalid manager employee id";
  }

  if (!reachable.has(employeeId)) {
    return "not reachable from hierarchy roots";
  }

  return "unknown";
}

export function auditEmployeeRecords(
  employees: EmployeeData[],
): EmployeeAuditResult {
  const groups = dedupeGroups(employees);
  const uniqueAfterDedupe = groups.length;
  const duplicateExtraRows = employees.length - uniqueAfterDedupe;

  const duplicateGroups: DuplicateGroupRow[] = [];
  groups
    .filter((group) => group.length > 1)
    .forEach((group, index) => {
      const groupId = `DUP-${index + 1}`;
      const matchReason = getDuplicateMatchReasons(group);
      for (const employee of group) {
        duplicateGroups.push({
          ...toAuditRow(employee),
          groupId,
          matchReason,
        });
      }
    });

  const canonicalEmployees = groups.map(
    (group) =>
      group.reduce((best, current) =>
        current.updatedAt > best.updatedAt ? current : best,
      ),
  );

  const allIds = new Set(
    canonicalEmployees
      .map((employee) => employee.employeeId?.trim())
      .filter(Boolean) as string[],
  );

  const { reachable, roots } = getReachableEmployeeIds(canonicalEmployees);

  const orphans: OrphanRow[] = [];
  let missingEmployeeIdRows = 0;
  let invalidManagerIdRows = 0;

  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    if (!employeeId) {
      missingEmployeeIdRows += 1;
      orphans.push({
        ...toAuditRow(employee),
        orphanReason: "missing employee id",
      });
      continue;
    }

    const managerId = employee.directManagerEmployeeId?.trim();
    if (managerId && !allIds.has(managerId)) {
      invalidManagerIdRows += 1;
    }
  }

  for (const employee of canonicalEmployees) {
    const employeeId = employee.employeeId?.trim();
    if (!employeeId) continue;

    if (!reachable.has(employeeId)) {
      orphans.push({
        ...toAuditRow(employee),
        orphanReason: getOrphanReason(employee, allIds, reachable),
      });
    }
  }

  const uniqueOrphans = new Map<string, OrphanRow>();
  for (const orphan of orphans) {
    const key =
      orphan.employeeId !== "—"
        ? `id:${orphan.employeeId}:${orphan.orphanReason}`
        : `row:${orphan.dbRowId}:${orphan.orphanReason}`;
    if (!uniqueOrphans.has(key)) {
      uniqueOrphans.set(key, orphan);
    }
  }

  const orphanRows = [...uniqueOrphans.values()];

  return {
    summary: {
      totalRawRows: employees.length,
      uniqueAfterDedupe,
      duplicateExtraRows,
      inHierarchyCount: reachable.size,
      orphanCount: orphanRows.length,
      missingEmployeeIdRows,
      invalidManagerIdRows,
      rootEmployeeCount: roots.length,
    },
    duplicateGroups,
    orphans: orphanRows,
  };
}
