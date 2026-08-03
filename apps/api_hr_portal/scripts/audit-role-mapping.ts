import fs from "fs";
import path from "path";
import "reflect-metadata";
import dotenv from "dotenv";
import xlsx from "xlsx";
import { AppDataSource, EmployeeData, User, UserRole } from "@hr-portal/database";
import { AccessService } from "../src/modules/access/access.service";

dotenv.config();

interface RoleAuditRow {
  employeeId: string;
  fullName: string;
  email: string;
  department: string;
  resolvedRole: UserRole;
  storedUserRole: string;
  roleMismatch: string;
  hrbpAssignees: number;
  directReports: number;
  accessibleScope: number;
  alsoManager: string;
  issue: string;
}

function normalizeId(value?: string | null): string {
  return value?.trim() ?? "";
}

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeName(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function sheetFromRows<T extends Record<string, unknown>>(
  rows: T[],
  headers: Array<keyof T & string>,
): xlsx.WorkSheet {
  const data = rows.map((row) =>
    headers.reduce<Record<string, unknown>>((entry, header) => {
      entry[header] = row[header];
      return entry;
    }, {}),
  );

  return xlsx.utils.json_to_sheet(data, {
    header: headers as string[],
  });
}

function pickBestEmployeeRecord(records: EmployeeData[]): EmployeeData {
  return records.reduce((best, current) => {
    const score = (record: EmployeeData) =>
      (normalizeId(record.employeeId) ? 4 : 0) +
      (normalizeEmail(record.officialEmailId) ? 2 : 0) +
      (record.fullName?.trim() ? 1 : 0);

    return score(current) > score(best) ? current : best;
  });
}

function buildDownlineMap(employees: EmployeeData[]): Map<string, Set<string>> {
  const reportsByManager = new Map<string, string[]>();

  for (const employee of employees) {
    const employeeId = normalizeId(employee.employeeId);
    const managerId = normalizeId(employee.directManagerEmployeeId);
    if (!employeeId || !managerId) continue;
    const bucket = reportsByManager.get(managerId) ?? [];
    bucket.push(employeeId);
    reportsByManager.set(managerId, bucket);
  }

  const downlineMap = new Map<string, Set<string>>();

  const collect = (managerId: string): Set<string> => {
    const cached = downlineMap.get(managerId);
    if (cached) return cached;

    const downline = new Set<string>();
    const queue = [...(reportsByManager.get(managerId) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || downline.has(current)) continue;
      downline.add(current);
      queue.push(...(reportsByManager.get(current) ?? []));
    }

    downlineMap.set(managerId, downline);
    return downline;
  };

  for (const managerId of reportsByManager.keys()) {
    collect(managerId);
  }

  return downlineMap;
}

function buildHrbpAssigneeMap(employees: EmployeeData[]): {
  byEmployeeId: Map<string, Set<string>>;
  byName: Map<string, Set<string>>;
} {
  const byEmployeeId = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();

  for (const employee of employees) {
    const assigneeId = normalizeId(employee.employeeId);
    if (!assigneeId) continue;

    const hrbpId = normalizeId(employee.hrbpEmployeeId);
    if (hrbpId) {
      const bucket = byEmployeeId.get(hrbpId) ?? new Set<string>();
      bucket.add(assigneeId);
      byEmployeeId.set(hrbpId, bucket);
    }

    const hrbpName = normalizeName(employee.hrbpName);
    if (hrbpName) {
      const bucket = byName.get(hrbpName) ?? new Set<string>();
      bucket.add(assigneeId);
      byName.set(hrbpName, bucket);
    }
  }

  return { byEmployeeId, byName };
}

function getHrbpAssignees(
  employee: EmployeeData,
  maps: ReturnType<typeof buildHrbpAssigneeMap>,
): Set<string> {
  const assignees = new Set<string>();
  const employeeId = normalizeId(employee.employeeId);
  const fullName = normalizeName(employee.fullName);

  if (employeeId) {
    for (const id of maps.byEmployeeId.get(employeeId) ?? []) {
      assignees.add(id);
    }
  }

  if (fullName) {
    for (const id of maps.byName.get(fullName) ?? []) {
      assignees.add(id);
    }
  }

  return assignees;
}

function resolveRoleFast(
  employee: EmployeeData,
  hrbpMaps: ReturnType<typeof buildHrbpAssigneeMap>,
  downlineMap: Map<string, Set<string>>,
  email: string,
): UserRole {
  if (AccessService.isAdminEmail(email)) {
    return UserRole.ADMIN;
  }

  const employeeId = normalizeId(employee.employeeId);
  if (!employeeId) {
    return UserRole.EMPLOYEE;
  }

  if (getHrbpAssignees(employee, hrbpMaps).size > 0) {
    return UserRole.HRBP;
  }

  const downline = downlineMap.get(employeeId);
  return downline && downline.size > 0 ? UserRole.MANAGER : UserRole.EMPLOYEE;
}

function getAccessibleScopeSize(
  employee: EmployeeData,
  role: UserRole,
  hrbpMaps: ReturnType<typeof buildHrbpAssigneeMap>,
  downlineMap: Map<string, Set<string>>,
  totalEmployees: number,
): number {
  if (role === UserRole.ADMIN) {
    return totalEmployees;
  }

  const employeeId = normalizeId(employee.employeeId);
  if (!employeeId) {
    return 0;
  }

  if (role === UserRole.EMPLOYEE) {
    return 1;
  }

  if (role === UserRole.MANAGER) {
    const downline = downlineMap.get(employeeId) ?? new Set<string>();
    downline.add(employeeId);
    return downline.size;
  }

  const scope = new Set(getHrbpAssignees(employee, hrbpMaps));
  const downline = downlineMap.get(employeeId);
  if (downline) {
    scope.add(employeeId);
    for (const id of downline) {
      scope.add(id);
    }
  }
  return scope.size;
}

async function main(): Promise<void> {
  const outputArg = process.argv[2];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultOutput = path.join(
    __dirname,
    "..",
    "reports",
    `role-mapping-audit-${timestamp}.xlsx`,
  );
  const outputPath = path.resolve(outputArg || defaultOutput);

  await AppDataSource.initialize();

  const employees = await AppDataSource.getRepository(EmployeeData).find({
    order: { employeeId: "ASC", id: "ASC" },
  });
  const users = await AppDataSource.getRepository(User).find();
  const usersByEmail = new Map(
    users.map((user) => [normalizeEmail(user.email), user]),
  );

  const hrbpMaps = buildHrbpAssigneeMap(employees);
  const downlineMap = buildDownlineMap(employees);

  const emailToEmployees = new Map<string, EmployeeData[]>();
  for (const employee of employees) {
    const email = normalizeEmail(employee.officialEmailId);
    if (!email) continue;
    const bucket = emailToEmployees.get(email) ?? [];
    bucket.push(employee);
    emailToEmployees.set(email, bucket);
  }

  const roleCounts: Record<UserRole, number> = {
    [UserRole.ADMIN]: 0,
    [UserRole.HRBP]: 0,
    [UserRole.MANAGER]: 0,
    [UserRole.EMPLOYEE]: 0,
  };

  const rows: RoleAuditRow[] = [];
  let duplicateEmails = 0;
  let missingEmailRows = 0;
  let missingEmployeeIdRows = 0;

  for (const employee of employees) {
    if (!normalizeEmail(employee.officialEmailId)) missingEmailRows += 1;
    if (!normalizeId(employee.employeeId)) missingEmployeeIdRows += 1;
  }

  for (const [email, emailEmployees] of emailToEmployees.entries()) {
    if (emailEmployees.length > 1) duplicateEmails += 1;

    const employee = pickBestEmployeeRecord(emailEmployees);
    const resolvedRole = resolveRoleFast(
      employee,
      hrbpMaps,
      downlineMap,
      email,
    );
    roleCounts[resolvedRole] += 1;

    const user = usersByEmail.get(email);
    const storedUserRole = user?.role ?? "—";
    const roleMismatch =
      user && user.role !== resolvedRole ? `${storedUserRole} -> ${resolvedRole}` : "—";

    const employeeId = normalizeId(employee.employeeId);
    const hrbpAssignees = getHrbpAssignees(employee, hrbpMaps).size;
    const directReports = employeeId
      ? (downlineMap.get(employeeId)?.size ?? 0)
      : 0;
    const accessibleScope = getAccessibleScopeSize(
      employee,
      resolvedRole,
      hrbpMaps,
      downlineMap,
      employees.length,
    );
    const alsoManager =
      resolvedRole === UserRole.HRBP && employeeId
        ? (downlineMap.get(employeeId)?.size ?? 0) > 0
        : false;

    const issues: string[] = [];
    if (!employeeId) issues.push("Missing employeeId");
    if (emailEmployees.length > 1) issues.push("Duplicate email in employee_data");
    if (roleMismatch !== "—") issues.push("User table role differs from resolved role");
    if (resolvedRole === UserRole.MANAGER && directReports === 0) {
      issues.push("Resolved manager but no direct reports found");
    }
    if (resolvedRole === UserRole.HRBP && hrbpAssignees === 0) {
      issues.push("Resolved HRBP but no HRBP assignees found");
    }

    rows.push({
      employeeId: employeeId || "—",
      fullName: employee.fullName?.trim() || "—",
      email,
      department: employee.department?.trim() || "—",
      resolvedRole,
      storedUserRole,
      roleMismatch,
      hrbpAssignees,
      directReports,
      accessibleScope,
      alsoManager: alsoManager ? "yes" : "no",
      issue: issues.join("; ") || "—",
    });
  }

  const issueRows = rows.filter((row) => row.issue !== "—");
  const mismatchRows = rows.filter((row) => row.roleMismatch !== "—");

  console.log("\nRole Mapping Audit");
  console.log("==================");
  console.log(`Unique login emails           : ${rows.length}`);
  console.log(`Admin                         : ${roleCounts[UserRole.ADMIN]}`);
  console.log(`HRBP                          : ${roleCounts[UserRole.HRBP]}`);
  console.log(`Manager                       : ${roleCounts[UserRole.MANAGER]}`);
  console.log(`Employee                      : ${roleCounts[UserRole.EMPLOYEE]}`);
  console.log(`Duplicate emails              : ${duplicateEmails}`);
  console.log(`Rows missing official email   : ${missingEmailRows}`);
  console.log(`Rows missing employeeId       : ${missingEmployeeIdRows}`);
  console.log(`Resolved vs stored mismatches : ${mismatchRows.length}`);
  console.log(`Rows with mapping issues      : ${issueRows.length}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows(
      [
        {
          uniqueEmails: rows.length,
          admin: roleCounts[UserRole.ADMIN],
          hrbp: roleCounts[UserRole.HRBP],
          manager: roleCounts[UserRole.MANAGER],
          employee: roleCounts[UserRole.EMPLOYEE],
          duplicateEmails,
          missingEmailRows,
          missingEmployeeIdRows,
          roleMismatches: mismatchRows.length,
          issueRows: issueRows.length,
        },
      ],
      [
        "uniqueEmails",
        "admin",
        "hrbp",
        "manager",
        "employee",
        "duplicateEmails",
        "missingEmailRows",
        "missingEmployeeIdRows",
        "roleMismatches",
        "issueRows",
      ],
    ),
    "Summary",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows(rows as unknown as Array<Record<string, unknown>>, [
      "employeeId",
      "fullName",
      "email",
      "department",
      "resolvedRole",
      "storedUserRole",
      "roleMismatch",
      "hrbpAssignees",
      "directReports",
      "accessibleScope",
      "alsoManager",
      "issue",
    ]),
    "AllUsers",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows(issueRows as unknown as Array<Record<string, unknown>>, [
      "employeeId",
      "fullName",
      "email",
      "department",
      "resolvedRole",
      "storedUserRole",
      "roleMismatch",
      "hrbpAssignees",
      "directReports",
      "accessibleScope",
      "alsoManager",
      "issue",
    ]),
    "Issues",
  );
  xlsx.writeFile(workbook, outputPath);
  console.log(`\nAudit file written to:\n${outputPath}`);

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
