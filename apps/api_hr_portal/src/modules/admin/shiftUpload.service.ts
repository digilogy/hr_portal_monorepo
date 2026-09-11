import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import { UploadJob, Shift } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { employeeDataRepository } from "./employeeData.repository";
import { shiftRepository } from "./shift.repository";

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
    let failureCount = 0;
    let totalRows = 0;
    let skippedEmptyRows = 0;

    for (const [index, row] of rows.entries()) {
      const mappedValues = mapRow(row);
      const name = mappedValues.name;

      const hasData = Object.values(mappedValues).some((value) => value !== "");
      if (!hasData) {
        skippedEmptyRows++;
        continue;
      }

      totalRows++;
      const rowNumber = index + 2;

      const allowedTimings = mappedValues.allowedTimings;
      
      if (!name || !allowedTimings) {
        failureCount++;
        const message = "Missing required field: Shift Name and Timings";
        console.error(`ROW ${rowNumber} FAILED VALIDATION! Raw row:`, JSON.stringify(row), `Mapped values:`, JSON.stringify(mappedValues));
        if (errors.length < 100) {
          errors.push({ row: mappedValues, error: message, rowIndex: rowNumber });
        }
        await writeUploadLog(job, rowNumber, "", "failed", message, mappedValues);
        logger.warn(LOG_CONTEXT, message, { jobId: job.id, rowIndex: rowNumber });
        continue;
      }

      try {
        const workingDays = mappedValues.workingDays;
        const offDays = mappedValues.offDays;
        const halfDay = mappedValues.halfDay;

        let shift = await shiftRepository.findShiftByName(name);
        if (!shift) {
          shift = await shiftRepository.createShift({
            name,
            allowedTimings,
            workingDays,
            offDays,
            halfDay,
          });
          addedCount++;
          await writeUploadLog(job, rowNumber, name, "success", "Imported shift successfully", mappedValues);
        } else {
          const updatePayload: Partial<Shift> = {};
          if (allowedTimings) updatePayload.allowedTimings = allowedTimings;
          if (workingDays) updatePayload.workingDays = workingDays;
          if (offDays) updatePayload.offDays = offDays;
          if (halfDay) updatePayload.halfDay = halfDay;

          if (Object.keys(updatePayload).length > 0) {
            await shiftRepository.updateShift(shift, updatePayload);
          }
          await writeUploadLog(job, rowNumber, name, "success", "Shift updated successfully", mappedValues);
          updatedCount++;
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
        failureCount++;
        const message =
          error instanceof Error ? error.message : "Unknown error";
        if (errors.length < 100) {
          errors.push({ row: mappedValues, error: message, rowIndex: rowNumber });
        }
        await writeUploadLog(
          job,
          rowNumber,
          name,
          "failed",
          message,
          mappedValues,
        );
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

    const successCount = addedCount + updatedCount;
    logger.info(LOG_CONTEXT, "Shift upload completed", {
      jobId: job.id,
      totalRows,
      successCount,
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
