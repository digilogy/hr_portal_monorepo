import xlsx from "xlsx";
import PDFDocument from "pdfkit";
import { EmployeeData } from "@hr-portal/database";
import { teamReportsRepository } from "./teamReports.repository";

function getTaskDisplayTitle(slot: {
  title?: string;
  taskType?: string;
}): string {
  if (slot.taskType === "Custom" && slot.title) return slot.title;
  if (slot.taskType?.trim()) return slot.taskType;
  return slot.title?.trim() || "—";
}

function calculateSlotHours(timeSlot: string): number | null {
  if (!timeSlot || timeSlot === "—") return null;
  const parts = timeSlot.split(" - ");
  if (parts.length !== 2) return null;

  const parseTime = (timeStr: string) => {
    const [time, period] = timeStr.trim().split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h + m / 60;
  };

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  let diff = end - start;
  if (diff < 0) diff += 24;
  return Math.round(diff * 60) / 60;
}

export async function getTimesheetTaskExportRows(
  employees: EmployeeData[],
  from: string,
  to: string,
): Promise<Record<string, string | number>[]> {
  const exportEntries = await teamReportsRepository.findTimesheetEntriesForExport(
    employees,
    from,
    to,
  );

  const rows: Record<string, string | number>[] = [];

  for (const { employee, entry } of exportEntries) {
    for (const slot of entry.slots) {
      if (!slot.task?.trim()) continue;

      const hours = calculateSlotHours(slot.timeSlot);
      rows.push({
        "Emp ID": employee.employeeId || "—",
        Employee: employee.fullName || "—",
        Department: employee.department || "—",
        Date: entry.date,
        "Time Slot": slot.timeSlot,
        Title: getTaskDisplayTitle(slot),
        Description: slot.task,
        Hours: hours ?? "—",
      });
    }
  }

  rows.sort((a, b) => {
    const empCompare = String(a["Emp ID"]).localeCompare(String(b["Emp ID"]));
    if (empCompare !== 0) return empCompare;
    const dateCompare = String(a.Date).localeCompare(String(b.Date));
    if (dateCompare !== 0) return dateCompare;
    return String(a["Time Slot"]).localeCompare(String(b["Time Slot"]));
  });

  return rows;
}

export function buildExcelBuffer(
  rows: Record<string, string | number>[],
  sheetName: string,
  additionalSheets: Array<{
    name: string;
    rows: Record<string, string | number>[];
  }> = [],
): Buffer {
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(rows),
    sheetName.slice(0, 31),
  );

  for (const sheet of additionalSheets) {
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(sheet.rows),
      sheet.name.slice(0, 31),
    );
  }

  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function renderPdfTable(
  doc: PDFKit.PDFDocument,
  rows: Record<string, string | number>[],
): void {
  if (rows.length === 0) {
    doc.fontSize(9).font("Helvetica").text("No data available.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const colWidth = tableWidth / headers.length;
  const rowHeight = 16;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawHeader = (y: number) => {
    doc.fontSize(8).font("Helvetica-Bold");
    headers.forEach((header, index) => {
      doc.text(String(header), left + index * colWidth + 2, y, {
        width: colWidth - 4,
        height: rowHeight,
        ellipsis: true,
      });
    });
    doc
      .moveTo(left, y + rowHeight)
      .lineTo(right, y + rowHeight)
      .strokeColor("#cccccc")
      .stroke();
  };

  let y = doc.y;
  drawHeader(y);
  y += rowHeight;

  doc.font("Helvetica").fontSize(7);
  for (const row of rows) {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader(y);
      y += rowHeight;
    }

    headers.forEach((header, index) => {
      doc.text(String(row[header] ?? ""), left + index * colWidth + 2, y, {
        width: colWidth - 4,
        height: rowHeight,
        ellipsis: true,
      });
    });
    y += rowHeight;
  }

  doc.y = y + 8;
}

export function buildPdfBuffer(
  title: string,
  periodLabel: string,
  sheets: Array<{ name: string; rows: Record<string, string | number>[] }>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 36,
      size: "A4",
      layout: "landscape",
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "center" });
    doc.fontSize(10).font("Helvetica").text(periodLabel, { align: "center" });
    doc.moveDown(1);

    for (const sheet of sheets) {
      doc.fontSize(12).font("Helvetica-Bold").text(sheet.name);
      doc.moveDown(0.5);
      renderPdfTable(doc, sheet.rows);
      doc.moveDown(1);
    }

    doc.end();
  });
}
