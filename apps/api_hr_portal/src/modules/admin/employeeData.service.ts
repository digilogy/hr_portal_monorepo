import fs from "fs";
import path from "path";
import csv from "csv-parser";
import xlsx from "xlsx";
import { EmployeeData, UploadJob } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { employeeDataRepository } from "./employeeData.repository";
import { shiftRepository } from "./shift.repository";

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
  zone: "zone",
};

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

function buildEmployeeRecord(mappedValues: Record<string, string>) {
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

    for (const [index, row] of rows.entries()) {
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

      if (!employeeId && !officialEmailId) {
        failureCount++;
        const message =
          "Missing required field: Employee Id or Official Email Id";
        if (errors.length < 100) {
          errors.push({ row: mappedRow, error: message, rowIndex: rowNumber });
        }
        await writeUploadLog(
          job,
          rowNumber,
          "",
          "failed",
          message,
          mappedRow,
        );
        logger.warn(LOG_CONTEXT, message, {
          jobId: job.id,
          rowIndex: rowNumber,
        });
        continue;
      }

      try {
        let existing: EmployeeData | null = null;
        if (employeeId) {
          existing = await employeeDataRepository.findByEmployeeId(employeeId);
        }
        if (!existing && officialEmailId) {
          existing = await employeeDataRepository.findByEmailCaseInsensitive(officialEmailId);
        }

        if (existing) {
          Object.assign(existing, mappedRow);
          await employeeDataRepository.save(existing);
          updatedCount++;
          processedIds.push(existing.id);
          const message = "Updated existing record";
          await writeUploadLog(
            job,
            rowNumber,
            employeeId || officialEmailId,
            "success",
            message,
            mappedRow,
          );
        } else {
          let newEmployeeData = employeeDataRepository.create(mappedRow);
          newEmployeeData = await employeeDataRepository.save(newEmployeeData);
          addedCount++;
          processedIds.push(newEmployeeData.id);
          await writeUploadLog(
            job,
            rowNumber,
            employeeId || officialEmailId,
            "success",
            "Imported successfully",
            mappedRow,
          );
        }

        const attendanceShift = mappedRow.attendanceShift;
        if (attendanceShift) {
          const shift = await shiftRepository.findShiftByName(attendanceShift);
          if (shift) {
            const finalEmployeeId = employeeId || existing?.employeeId;
            if (finalEmployeeId) {
              await shiftRepository.upsertAssignment({
                employeeId: finalEmployeeId,
                shiftId: shift.id,
              });
            }
          }
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
          errors.push({ row: mappedRow, error: message, rowIndex: rowNumber });
        }
        await writeUploadLog(
          job,
          rowNumber,
          employeeId || officialEmailId,
          "failed",
          message,
          mappedRow,
        );
        logger.error(LOG_CONTEXT, "Row import failed", {
          jobId: job.id,
          rowIndex: rowNumber,
          employeeId: employeeId || officialEmailId,
          error: message,
        });
      }
    }

    if (processedIds.length > 0) {
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
