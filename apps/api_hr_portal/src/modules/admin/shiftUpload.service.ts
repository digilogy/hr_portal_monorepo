import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import { UploadJob, Shift } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { employeeDataRepository } from "./employeeData.repository";
import { shiftRepository } from "./shift.repository";
import { throwIfUploadCancelled } from "./uploadCancellation";
import { RedisService } from "@hr-portal/auth";
import { normalizeAllowedTimings, normalizeHalfDay, normalizeShiftName, shiftKey } from "./shiftRules";

const LOG_CONTEXT = "ShiftUpload";
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
  "shift name": "name",
  "shift block name": "name",
  "attendance shift": "name",
  "allowed timings": "allowedTimings",
  "timings": "allowedTimings",
  "working days": "workingDays",
  "off days": "offDays",
  "weekly off": "offDays",
  "half day": "halfDay",
  "half day optional": "halfDay",
};

const SHIFT_NAME_HEADERS = new Set(["shift name", "shiftname"]);

function mapRow(row: Record<string, unknown>): Record<string, string> {
  const mappedValues: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    const normalizedKey = normalizeHeader(key);
    const mappedKey = fieldAliases[normalizedKey] ?? normalizedKey;
    const value = getString(row[key]);
    
    if (value !== "" || !mappedValues[mappedKey]) {
      mappedValues[mappedKey] = value;
    }
  }
  return mappedValues;
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

/** Shift names (by shiftKey) that had no valid Shift Detail row, with the first row's reason. */
export type RejectedShifts = Map<string, { rowNumber: number; reason: string }>;

export class ShiftUploadService {
  static async processBulkUpload(
    filePath: string,
    job: UploadJob,
    options: { deleteFile?: boolean } = { deleteFile: true }
  ): Promise<{
    totalRows: number;
    successCount: number;
    failureCount: number;
    addedCount: number;
    updatedCount: number;
    errors: Array<{ rowIndex: number; error: string; row: Record<string, string> }>;
    rejectedShifts: RejectedShifts;
  }> {
    const extension = path.extname(filePath).toLowerCase();
    logger.info(LOG_CONTEXT, "Starting shift upload", {
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
    let unchangedCount = 0;
    let failureCount = 0;
    let totalRows = 0;
    let skippedEmptyRows = 0;

    const shiftsByKey = await shiftRepository.getShiftsByKey();
    // First valid row per shift name; repeated rows must match it.
    const accepted = new Map<string, { rowNumber: number; allowedTimings: string; halfDay: string }>();
    // Shift names with no valid row in this file, for the employee upload's error messages.
    const rejectedShifts: RejectedShifts = new Map();

    const fail = async (rowNumber: number, name: string, message: string, mappedValues: Record<string, string>) => {
      failureCount++;
      if (errors.length < 100) {
        errors.push({ row: mappedValues, error: message, rowIndex: rowNumber });
      }
      await writeUploadLog(job, rowNumber, name, "failed", message, mappedValues);
      logger.warn(LOG_CONTEXT, message, { jobId: job.id, rowIndex: rowNumber });
    };

    for (const [index, row] of rows.entries()) {
      throwIfUploadCancelled(job.id);
      const mappedValues = mapRow(row);

      const hasData = Object.values(mappedValues).some((value) => value !== "");
      if (!hasData) {
        skippedEmptyRows++;
        continue;
      }

      totalRows++;
      const rowNumber = index + 2;
      const prefix = `[Shift Detail] Row ${rowNumber}`;
      const name = normalizeShiftName(mappedValues.name ?? "");

      if (!name) {
        await fail(rowNumber, "", `${prefix}: Shift Name is empty.`, mappedValues);
        continue;
      }

      const key = shiftKey(name);
      const rawTimings = mappedValues.allowedTimings ?? "";
      const rawHalfDay = mappedValues.halfDay ?? "";
      const problems: string[] = [];
      let allowedTimings = "";
      let halfDay = "";

      if (!rawTimings) {
        problems.push(`Allowed Timings is empty for shift "${name}"`);
      } else {
        const timings = normalizeAllowedTimings(rawTimings);
        if (timings.ok) allowedTimings = timings.value;
        else problems.push(
          `Allowed Timings "${rawTimings}" for shift "${name}" is not valid: ${timings.reason}. ` +
          "Use HH:MM - HH:MM (e.g. 09:30 - 19:30); separate multiple timings with commas",
        );
      }

      const half = normalizeHalfDay(rawHalfDay);
      if (half.ok) halfDay = half.value;
      else problems.push(
        `Half Day "${rawHalfDay}" for shift "${name}" is not valid: ${half.reason}. ` +
        "Use Day (HH:MM - HH:MM), e.g. Sat (08:00 - 12:30), or several days, e.g. Sat, Sun (09:30 - 19:30)",
      );

      if (problems.length > 0) {
        if (!accepted.has(key) && !rejectedShifts.has(key)) {
          rejectedShifts.set(key, { rowNumber, reason: problems.join("; ") });
        }
        await fail(rowNumber, name, `${prefix}: ${problems.join("; ")}.`, mappedValues);
        continue;
      }

      const earlier = accepted.get(key);
      if (earlier) {
        if (earlier.allowedTimings === allowedTimings && earlier.halfDay === halfDay) {
          unchangedCount++;
          await writeUploadLog(job, rowNumber, name, "success", `${prefix}: Same as row ${earlier.rowNumber}; already applied.`, mappedValues);
        } else {
          await fail(
            rowNumber,
            name,
            `${prefix}: Shift "${name}" is already in row ${earlier.rowNumber} with Allowed Timings ` +
            `"${earlier.allowedTimings}" and Half Day "${earlier.halfDay || "—"}", but this row has ` +
            `"${allowedTimings}" and "${halfDay || "—"}". Rows with the same Shift Name must match. ` +
            `Row ${earlier.rowNumber} was used.`,
            mappedValues,
          );
        }
        continue;
      }

      try {
        // Weekly off now comes from each employee's row. Off Days is kept only from old-format
        // sheets that still have the column; otherwise it is cleared so stale values can't apply.
        const hasOffDaysColumns = "offDays" in mappedValues || "workingDays" in mappedValues;
        const payload: Partial<Shift> = {
          allowedTimings,
          halfDay,
          workingDays: hasOffDaysColumns ? mappedValues.workingDays ?? "" : "",
          offDays: hasOffDaysColumns ? mappedValues.offDays ?? "" : "",
        };

        const existing = shiftsByKey.get(key);
        if (existing) {
          await shiftRepository.updateShift(existing, payload);
          updatedCount++;
          await writeUploadLog(job, rowNumber, name, "success", "Shift updated successfully", mappedValues);
        } else {
          const created = await shiftRepository.createShift({ name, ...payload });
          shiftsByKey.set(key, created);
          addedCount++;
          await writeUploadLog(job, rowNumber, name, "success", "Imported shift successfully", mappedValues);
        }
        accepted.set(key, { rowNumber, allowedTimings, halfDay });
        rejectedShifts.delete(key);

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
        const message = error instanceof Error ? error.message : "Unknown error";
        if (!accepted.has(key) && !rejectedShifts.has(key)) {
          rejectedShifts.set(key, { rowNumber, reason: `could not be saved: ${message}` });
        }
        await fail(rowNumber, name, `${prefix}: Shift "${name}" could not be saved: ${message}.`, mappedValues);
        logger.error(LOG_CONTEXT, "Row import failed", {
          jobId: job.id,
          rowIndex: rowNumber,
          shiftName: name,
          error: message,
        });
      }
    }

    if (options.deleteFile !== false && isUploadTempFile(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }

    const successCount = addedCount + updatedCount + unchangedCount;
    if (addedCount + updatedCount > 0) {
      // Profiles carry the shift's timings and half day.
      await RedisService.deletePattern("profile_v2:*");
    }

    logger.info(LOG_CONTEXT, "Shift upload completed", {
      jobId: job.id,
      totalRows,
      successCount,
      failureCount,
      skippedEmptyRows,
      rejectedShifts: rejectedShifts.size,
    });

    return {
      totalRows,
      successCount,
      failureCount,
      addedCount,
      updatedCount,
      errors,
      rejectedShifts,
    };
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
    const sheet = this.findShiftDataSheet(workbook);
    if (!sheet) {
      throw new Error("Uploaded file does not contain a valid shift details sheet");
    }

    return xlsx.utils.sheet_to_json(sheet, { defval: "" });
  }

  private static findShiftDataSheet(
    workbook: xlsx.WorkBook,
  ): xlsx.WorkSheet | null {
    // First pass: try to find by name
    for (const sheetName of workbook.SheetNames) {
      if (/shift detail/i.test(sheetName) || /shift rule/i.test(sheetName)) {
        return workbook.Sheets[sheetName];
      }
    }

    // Second pass: try to find by headers, but explicitly skip employee data sheets
    for (const sheetName of workbook.SheetNames) {
      if (/pivot/i.test(sheetName)) continue;
      if (/employee/i.test(sheetName) || /emp/i.test(sheetName)) continue;

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

      if (
        normalizedHeaders.some(
          (header) =>
            header.includes("timing") ||
            header.includes("working day") ||
            header.includes("half day") ||
            header.includes("off day")
        )
      ) {
        return sheet;
      }
    }

    return null;
  }
}
