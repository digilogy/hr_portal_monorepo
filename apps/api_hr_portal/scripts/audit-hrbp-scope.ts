import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource, EmployeeData, UserRole } from "@hr-portal/database";
import { AccessService } from "../src/modules/access/access.service";

dotenv.config();

const HRBP_ID = (process.argv[2] || "CG55935").trim();
const HRBP_EMAIL = (process.argv[3] || "").trim().toLowerCase();

function dedupeCount(employees: EmployeeData[]): number {
  const ids = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();
  let unique = 0;

  for (const employee of employees) {
    const employeeId = employee.employeeId?.trim();
    const email = employee.officialEmailId?.trim().toLowerCase();
    const name = (employee.fullName || "").trim().toLowerCase().replace(/\s+/g, " ");

    if (employeeId && ids.has(employeeId)) continue;
    if (email && emails.has(email)) continue;
    if (name && names.has(name)) continue;

    if (employeeId) ids.add(employeeId);
    if (email) emails.add(email);
    if (name) names.add(name);
    unique += 1;
  }

  return unique;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(EmployeeData);
  const all = await repo.find();

  const byHrbpId = all.filter(
    (employee) => (employee.hrbpEmployeeId || "").trim() === HRBP_ID,
  );
  const byHrbpName = all.filter((employee) =>
    /vignesh/i.test(employee.hrbpName || ""),
  );
  const missingEmployeeId = byHrbpId.filter(
    (employee) => !employee.employeeId?.trim(),
  );

  let hrbpUser =
    all.find((employee) => (employee.employeeId || "").trim() === HRBP_ID) ||
    null;

  if (!hrbpUser && HRBP_EMAIL) {
    hrbpUser = await AccessService.getEmployeeByEmail(HRBP_EMAIL);
  }

  if (!hrbpUser) {
    hrbpUser =
      all.find((employee) =>
        /c\.?\s*vignesh/i.test(employee.fullName || ""),
      ) || null;
  }

  const scopeIds = hrbpUser
    ? await AccessService.getHrbpAssignedEmployeeIds(hrbpUser)
    : new Set<string>();
  const scopeEmployees = hrbpUser
    ? await AccessService.getAccessibleEmployees(
        hrbpUser.officialEmailId || "",
        UserRole.HRBP,
      )
    : [];

  console.log("\nHRBP Scope Audit");
  console.log("================");
  console.log(`HRBP employee id filter : ${HRBP_ID}`);
  console.log(`Total employee_data rows: ${all.length}`);
  console.log(`Rows with hrbpEmployeeId=${HRBP_ID}: ${byHrbpId.length}`);
  console.log(`Rows with hrbpName ~ vignesh : ${byHrbpName.length}`);
  console.log(
    `Unique employeeId on those rows : ${new Set(byHrbpId.map((e) => e.employeeId?.trim()).filter(Boolean)).size}`,
  );
  console.log(`Rows missing employeeId       : ${missingEmployeeId.length}`);
  console.log(
    `Simple dedupe estimate          : ${dedupeCount(byHrbpId)} unique people`,
  );
  console.log(
    `\nHRBP login record: ${
      hrbpUser
        ? `${hrbpUser.fullName} (${hrbpUser.employeeId}) <${hrbpUser.officialEmailId}>`
        : "not found"
    }`,
  );
  console.log(`Resolved HRBP scope ids       : ${scopeIds.size}`);
  console.log(`Accessible employees fetched    : ${scopeEmployees.length}`);

  if (hrbpUser?.officialEmailId) {
    const role = await AccessService.resolveRole(hrbpUser.officialEmailId);
    console.log(`Resolved role on login        : ${role}`);

    const { TeamReportsService } = await import("../src/modules/reports/teamReports.service");
    const roster = await TeamReportsService.getTeamRoster(
      hrbpUser.officialEmailId,
      UserRole.HRBP,
      "2026-07-26",
      "2026-07-28",
    );
    const flatten = (nodes: typeof roster.members): typeof roster.members =>
      nodes.flatMap((node) => [
        node,
        ...(node.children ? flatten(node.children) : []),
      ]);
    const flat = flatten(roster.members);
    console.log(`Team roster summary total     : ${roster.summary.totalMembers}`);
    console.log(`Team roster flattened count   : ${flat.length}`);
    console.log(`Deduped visible (407-scope)   : ${scopeEmployees.length}`);
  }

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
