import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import { EmployeeData, UploadJob } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { employeeDataRepository } from "./employeeData.repository";
import { shiftRepository } from "./shift.repository";
import { throwIfUploadCancelled } from "./uploadCancellation";
import { RedisService } from "@hr-portal/auth";
import { normalizeWeeklyOff, shiftKey, WEEKLY_OFF_ALLOWED_TEXT } from "./shiftRules";
import type { RejectedShifts } from "./shiftUpload.service";
const LOG_CONTEXT = "BulkUpload";
const PROGRESS_LOG_INTERVAL = 500;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

const fieldAliases: Record<string, string> = {
  "employment status": "employmentStatus",
  "employee id": "employeeId",
  employeeid: "employeeId",
  "emp id": "employeeId",
  empid: "employeeId",
  "emp code": "employeeId",
  empcode: "employeeId",
  "employee code": "employeeId",
  "full name": "fullName",
  "job title": "jobTitle",
  department: "department",
  "sub department": "subDepartment",
  "direct manager employee id": "directManagerEmployeeId",
  "direct manager name": "directManagerName",
  "hrbp employee id": "hrbpEmployeeId",
  "hrbp name": "hrbpName",
  "hod employee id": "hodEmployeeId",
  "hod employee name": "hodEmployeeName",
  "official email id": "officialEmailId",
  "office mobile number": "officeMobileNumber",
  "attendance shift": "attendanceShift",
  "shift name": "attendanceShift",
  zone: "zone",
  "weekly off": "weeklyOff",
  policy: "policy",
};

// Columns where the HR export writes 0 for an empty cell.
const ZERO_MEANS_EMPTY = new Set([
  "subDepartment",
  "directManagerEmployeeId",
  "directManagerName",
  "hrbpEmployeeId",
  "hrbpName",
  "hodEmployeeId",
  "hodEmployeeName",
  "officeMobileNumber",
]);

const EMPLOYEE_ID_HEADERS = new Set([
  "employee id",
  "employeeid",
  "emp id",
  "empid",
  "emp code",
  "empcode",
  "employee code",
]);

function mapRow(row: Record<string, unknown>): Record<string, string> {
  const mappedValues: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = fieldAliases[normalizedKey] ?? normalizedKey;
    mappedValues[mappedKey] = getString(row[key]);
  }
  return mappedValues;
}

function buildEmployeeRecord(rawValues: Record<string, string>) {
  const mappedValues: Record<string, string> = { ...rawValues };
  for (const field of ZERO_MEANS_EMPTY) {
    if (mappedValues[field] === "0") mappedValues[field] = "";
  }
  return {
    employmentStatus: mappedValues["employmentStatus"] || "",
    employeeId: mappedValues["employeeId"] || "",
    fullName: mappedValues["fullName"] || "",
    jobTitle: mappedValues["jobTitle"] || "",
    department: mappedValues["department"] || "",
    subDepartment: mappedValues["subDepartment"] || "",
    directManagerEmployeeId: mappedValues["directManagerEmployeeId"] || "",
    directManagerName: mappedValues["directManagerName"] || "",
    hrbpEmployeeId: mappedValues["hrbpEmployeeId"] || "",
    hrbpName: mappedValues["hrbpName"] || "",
    hodEmployeeId: mappedValues["hodEmployeeId"] || "",
    hodEmployeeName: mappedValues["hodEmployeeName"] || "",
    officialEmailId: mappedValues["officialEmailId"] || "",
    officeMobileNumber: mappedValues["officeMobileNumber"] || "",
    attendanceShift: mappedValues["attendanceShift"] || "",
    zone: mappedValues["zone"] || "",
  };
}

function isUploadTempFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/uploads/");
}

async function writeUploadLog(
  job: UploadJob,
  rowIndex: number,
  employeeId: string,
  status: "success" | "failed",
  message: string,
  payload: Record<string, string>,
): Promise<void> {
  await employeeDataRepository.createUploadLog(
    job,
    rowIndex,
    employeeId,
    status,
    message,
    payload,
  );
}

export class EmployeeDataService {
  static async processBulkUpload(
    filePath: string,
    job: UploadJob,
    options: { deleteFile?: boolean; rejectedShifts?: RejectedShifts } = { deleteFile: true }
  ): Promise<{
    totalRows: number;
    successCount: number;
    failureCount: number;
    addedCount: number;
    updatedCount: number;
    errors: Array<{ rowIndex: number; error: string; row: Record<string, string> }>;
  }> {
    const extension = path.extname(filePath).toLowerCase();
    logger.info(LOG_CONTEXT, "Starting bulk upload", {
      jobId: job.id,
      fileName: job.fileName ?? path.basename(filePath),
      extension,
    });

    const rows = await this.parseFile(filePath, extension);
    logger.info(LOG_CONTEXT, "File parsed successfully", {
      jobId: job.id,
      parsedRows: rows.length,
    });

    const errors: Array<{
      rowIndex: number;
      error: string;
      row: Record<string, string>;
    }> = [];
    let addedCount = 0;
    let updatedCount = 0;
    let failureCount = 0;
    let totalRows = 0;
    let skippedEmptyRows = 0;
    const processedIds: number[] = [];
    // Set when a row failed before we could tell which saved employee it was: removing
    // "employees not in this upload" could then delete that employee.
    let unidentifiedFailure = false;

    // Loaded after the Shift Detail tab has been applied (master upload runs it first).
    const shiftsByKey = await shiftRepository.getShiftsByKey();

    const fail = async (rowNumber: number, employeeKey: string, message: string, mappedRow: Record<string, string>) => {
      failureCount++;
      if (errors.length < 100) {
        errors.push({ row: mappedRow, error: message, rowIndex: rowNumber });
      }
      await writeUploadLog(job, rowNumber, employeeKey, "failed", message, mappedRow);
      logger.warn(LOG_CONTEXT, message, { jobId: job.id, rowIndex: rowNumber });
    };

    for (const [index, row] of rows.entries()) {
      throwIfUploadCancelled(job.id);
      const mappedValues = mapRow(row);
      const mappedRow = buildEmployeeRecord(mappedValues);
      const employeeId = mappedRow.employeeId;
      const officialEmailId = mappedRow.officialEmailId;

      const hasData = Object.values(mappedRow).some((value) => value !== "");
      if (!hasData) {
        skippedEmptyRows++;
        continue;
      }

      totalRows++;
      const rowNumber = index + 2;
      const employeeKey = employeeId || officialEmailId;
      const prefix = `[Employee data] Row ${rowNumber}${employeeKey ? ` (${employeeKey})` : ""}`;

      if (!employeeId && !officialEmailId) {
        await fail(rowNumber, "", `${prefix}: Employee Id and Official Email Id are both empty. Row skipped.`, mappedRow);
        continue;
      }

      // Work out shift and weekly off before saving, so a bad cell never half-applies.
      const problems: string[] = [];
      const shiftName = mappedRow.attendanceShift;
      const shift = shiftName ? shiftsByKey.get(shiftKey(shiftName)) : undefined;
      if (!shiftName) {
        problems.push("Shift Name is empty");
      } else if (!shift) {
        const rejected = options.rejectedShifts?.get(shiftKey(shiftName));
        problems.push(rejected
          ? `Shift "${shiftName}" is not available because Shift Detail row ${rejected.rowNumber} failed (${rejected.reason})`
          : `Shift Name "${shiftName}" not found in Shift Detail`);
      }

      let weeklyOff: string | null = null;
      if ("weeklyOff" in mappedValues) {
        const rawWeeklyOff = mappedValues.weeklyOff;
        weeklyOff = normalizeWeeklyOff(rawWeeklyOff);
        if (!rawWeeklyOff) problems.push("Weekly Off is empty");
        else if (!weeklyOff) problems.push(`Weekly Off "${rawWeeklyOff}" is not recognised. Allowed: ${WEEKLY_OFF_ALLOWED_TEXT}`);
      } else if (shift) {
        // Old-format sheet without a Weekly Off column: the shift's Off Days applies.
        weeklyOff = normalizeWeeklyOff(shift.offDays);
      }

      let existing: EmployeeData | null = null;
      let saved = false;
      try {
        if (employeeId) {
          existing = await employeeDataRepository.findByEmployeeId(employeeId);
        }
        if (!existing && officialEmailId) {
          existing = await employeeDataRepository.findByEmailCaseInsensitive(officialEmailId);
        }

        let savedId: number;
        if (existing) {
          Object.assign(existing, mappedRow);
          await employeeDataRepository.save(existing);
          savedId = existing.id;
        } else {
          const created = await employeeDataRepository.save(employeeDataRepository.create(mappedRow));
          savedId = created.id;
        }
        processedIds.push(savedId);
        saved = true;

        const finalEmployeeId = employeeId || existing?.employeeId;
        if (problems.length === 0 && !finalEmployeeId) {
          problems.push("Employee Id is empty, so no shift can be assigned");
        }

        if (problems.length === 0 && shift && finalEmployeeId) {
          await shiftRepository.upsertAssignment({
            employeeId: finalEmployeeId,
            shiftId: shift.id,
            weeklyOff,
            policy: "policy" in mappedValues ? mappedValues.policy : undefined,
          });
        }

        const finalEmail = officialEmailId || existing?.officialEmailId;
        if (finalEmail) {
          const cacheKey = `profile_v2:${finalEmail.toLowerCase()}`;
          await RedisService.delete(cacheKey);
        }

        if (problems.length > 0) {
          await fail(
            rowNumber,
            employeeKey,
            `${prefix}: ${problems.join("; ")}. Employee details saved; previous shift and weekly off kept.`,
            mappedRow,
          );
        } else {
          if (existing) updatedCount++;
          else addedCount++;
          await writeUploadLog(
            job,
            rowNumber,
            employeeKey,
            "success",
            existing ? "Updated existing record" : "Imported successfully",
            mappedRow,
          );
        }

        if (totalRows % PROGRESS_LOG_INTERVAL === 0) {
          logger.info(LOG_CONTEXT, "Upload progress", {
            jobId: job.id,
            processedRows: totalRows,
            addedCount,
            updatedCount,
            failureCount,
          });
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        if (saved) {
          await fail(rowNumber, employeeKey, `${prefix}: Employee details saved, but the shift could not be assigned: ${message}. Previous shift and weekly off kept.`, mappedRow);
        } else {
          // Keep the existing employee: a failed row must not get them deleted below.
          if (existing) processedIds.push(existing.id);
          else if (!(await this.keepExisting(employeeId, officialEmailId, processedIds))) unidentifiedFailure = true;
          await fail(rowNumber, employeeKey, `${prefix}: Could not be saved: ${message}. Existing record kept (not deleted).`, mappedRow);
        }
        logger.error(LOG_CONTEXT, "Row import failed", {
          jobId: job.id,
          rowIndex: rowNumber,
          employeeId: employeeKey,
          error: message,
        });
      }
    }

    if (unidentifiedFailure) {
      logger.warn(LOG_CONTEXT, "Skipped removing employees not in this upload: a failed row could not be matched to a saved employee", {
        jobId: job.id,
      });
    } else if (processedIds.length > 0) {
      try {
        const deleteResult = await employeeDataRepository.deleteUnprocessed(processedIds);
        logger.info(LOG_CONTEXT, "Removed old employee data not present in this upload", {
          deletedCount: deleteResult.affected,
          keptCount: processedIds.length
        });
      } catch (error) {
        logger.error(LOG_CONTEXT, "Failed to remove old employee data", { error });
      }
    }

    if (options.deleteFile !== false && isUploadTempFile(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(LOG_CONTEXT, "Temporary upload file deleted", {
          jobId: job.id,
          filePath,
        });
      } catch {
        logger.warn(LOG_CONTEXT, "Failed to delete temporary upload file", {
          jobId: job.id,
          filePath,
        });
      }
    }

    const successCount = addedCount + updatedCount;
    if (processedIds.length > 0) {
      await RedisService.deletePattern("cache:employees:*");
      await RedisService.deletePattern("report*");
    }

    logger.info(LOG_CONTEXT, "Bulk upload completed", {
      jobId: job.id,
      totalRows,
      successCount,
      addedCount,
      updatedCount,
      failureCount,
      skippedEmptyRows,
      errorCount: errors.length,
    });

    return {
      totalRows,
      successCount,
      failureCount,
      addedCount,
      updatedCount,
      errors,
    };
  }

  /** After a failed save, finds the saved employee so it is kept. False if it can't be told. */
  private static async keepExisting(employeeId: string, officialEmailId: string, processedIds: number[]): Promise<boolean> {
    try {
      const found =
        (employeeId ? await employeeDataRepository.findByEmployeeId(employeeId) : null) ??
        (officialEmailId ? await employeeDataRepository.findByEmailCaseInsensitive(officialEmailId) : null);
      if (found) processedIds.push(found.id);
      return true;
    } catch {
      return false;
    }
  }

  private static async parseFile(
    filePath: string,
    extension: string,
  ): Promise<Record<string, unknown>[]> {
    if (extension === ".csv") {
      return new Promise((resolve, reject) => {
        const rows: Record<string, unknown>[] = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (data) => rows.push(data))
          .on("end", () => resolve(rows))
          .on("error", reject);
      });
    }

    const workbook = xlsx.readFile(filePath);
    const sheet = this.findEmployeeDataSheet(workbook);
    if (!sheet) {
      throw new Error(
        "Uploaded file does not contain a valid employee data sheet",
      );
    }

    return xlsx.utils.sheet_to_json(sheet, { defval: "" });
  }

  private static findEmployeeDataSheet(
    workbook: xlsx.WorkBook,
  ): xlsx.WorkSheet | null {
    for (const sheetName of workbook.SheetNames) {
      if (/pivot/i.test(sheetName)) {
        logger.debug(LOG_CONTEXT, "Skipping pivot sheet", { sheetName });
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const headerRows = xlsx.utils.sheet_to_json(sheet, {
        defval: "",
        header: 1,
        range: 0,
      }) as unknown[][];

      const headerRow = headerRows[0] ?? [];
      const normalizedHeaders = headerRow.map((header) =>
        normalizeHeader(String(header ?? "")),
      );

      if (normalizedHeaders.some((header) => EMPLOYEE_ID_HEADERS.has(header))) {
        logger.info(LOG_CONTEXT, "Selected employee data sheet", { sheetName });
        return sheet;
      }
    }

    const fallbackSheetName = workbook.SheetNames.find(
      (name) => !/pivot/i.test(name),
    );
    if (!fallbackSheetName) {
      return null;
    }

    logger.warn(LOG_CONTEXT, "Falling back to first non-pivot sheet", {
      sheetName: fallbackSheetName,
    });
    return workbook.Sheets[fallbackSheetName] ?? null;
  }
}
