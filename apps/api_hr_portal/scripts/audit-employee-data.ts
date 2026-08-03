import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import xlsx from "xlsx";
import { AppDataSource, EmployeeData } from "@hr-portal/database";
import {
  auditEmployeeRecords,
  DuplicateGroupRow,
  EmployeeAuditSummary,
  OrphanRow,
} from "../src/services/employeeAudit.service";

dotenv.config();

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

function printSummary(summary: EmployeeAuditSummary): void {
  console.log("\nEmployee Data Audit Summary");
  console.log("===========================");
  console.log(`Total raw rows in database     : ${summary.totalRawRows}`);
  console.log(`Unique employees after dedupe  : ${summary.uniqueAfterDedupe}`);
  console.log(`Duplicate extra rows           : ${summary.duplicateExtraRows}`);
  console.log(`Employees in hierarchy tree    : ${summary.inHierarchyCount}`);
  console.log(`Orphan / unlinked records      : ${summary.orphanCount}`);
  console.log(`Missing employee id rows       : ${summary.missingEmployeeIdRows}`);
  console.log(`Invalid manager id rows        : ${summary.invalidManagerIdRows}`);
  console.log(`Hierarchy root employees       : ${summary.rootEmployeeCount}`);
  console.log(
    `\nGap vs org headcount (raw - in tree): ${summary.totalRawRows - summary.inHierarchyCount}`,
  );
}

async function main() {
  const outputArg = process.argv[2];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultOutput = path.join(
    __dirname,
    "..",
    "reports",
    `employee-data-audit-${timestamp}.xlsx`,
  );
  const outputPath = path.resolve(outputArg || defaultOutput);

  console.log("Connecting to database...");
  await AppDataSource.initialize();

  const employees = await AppDataSource.getRepository(EmployeeData).find({
    order: { employeeId: "ASC", id: "ASC" },
  });

  const audit = auditEmployeeRecords(employees);
  printSummary(audit.summary);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows([audit.summary as unknown as Record<string, unknown>], [
      "totalRawRows",
      "uniqueAfterDedupe",
      "duplicateExtraRows",
      "inHierarchyCount",
      "orphanCount",
      "missingEmployeeIdRows",
      "invalidManagerIdRows",
      "rootEmployeeCount",
    ]),
    "Summary",
  );

  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows(
      audit.duplicateGroups as unknown as Array<Record<string, unknown>>,
      [
        "groupId",
        "matchReason",
        "dbRowId",
        "employeeId",
        "fullName",
        "email",
        "department",
        "managerId",
        "managerName",
        "status",
      ] as Array<keyof DuplicateGroupRow & string>,
    ),
    "Duplicates",
  );

  xlsx.utils.book_append_sheet(
    workbook,
    sheetFromRows(audit.orphans as unknown as Array<Record<string, unknown>>, [
      "orphanReason",
      "dbRowId",
      "employeeId",
      "fullName",
      "email",
      "department",
      "managerId",
      "managerName",
      "status",
    ] as Array<keyof OrphanRow & string>),
    "Orphans",
  );

  xlsx.writeFile(workbook, outputPath);

  console.log(`\nDuplicate groups exported : ${audit.duplicateGroups.length} rows`);
  console.log(`Orphan rows exported      : ${audit.orphans.length} rows`);
  console.log(`\nAudit file written to:\n${outputPath}`);

  await AppDataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error("Employee audit failed:", error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
