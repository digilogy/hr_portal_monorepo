import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { UserRole } from "@hr-portal/database";
import { AccessService } from "../access/access.service";
import { TeamReportsService, type RosterCardFilter } from "./teamReports.service";
import { parseReportFilters } from "./reportFilters";

function getReportFilters(req: AuthRequest) {
  return parseReportFilters(req.query);
}

function getRole(req: AuthRequest): UserRole {
  const role = req.user?.role;
  if (role === UserRole.ADMIN) return UserRole.ADMIN;
  if (role === UserRole.HRBP) return UserRole.HRBP;
  if (role === UserRole.MANAGER) return UserRole.MANAGER;
  return UserRole.EMPLOYEE;
}

function getDateRange(req: AuthRequest) {
  const fromDate =
    typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
  const toDate =
    typeof req.query.toDate === "string" ? req.query.toDate : undefined;
  return { fromDate, toDate };
}

function getPagination(req: AuthRequest) {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50),
  );
  return { page, pageSize };
}

function parseRosterCardFilter(query: unknown): RosterCardFilter {
  const valid = [
    "all",
    "active",
    "Submitted",
    "Pending",
    "on_track",
    "needs_attention",
  ] as const;
  if (
    typeof query === "string" &&
    valid.includes(query as (typeof valid)[number])
  ) {
    return query as (typeof valid)[number];
  }
  return "all";
}

export class TeamController {
  static async getRoster(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const filters = getReportFilters(req);
      const { page, pageSize } = getPagination(req);
      const rosterFilter = parseRosterCardFilter(req.query.rosterFilter);
      const data = await TeamReportsService.getTeamRoster(
        email,
        role,
        fromDate,
        toDate,
        filters,
        rosterFilter,
        page,
        pageSize,
      );
      res.status(200).json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }
}

export class ReportsController {
  static async getCapabilities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      const capabilities = await AccessService.getReportCapabilities(email, role);
      res.status(200).json(capabilities);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getUserWise(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const { page, pageSize } = getPagination(req);
      const filters = getReportFilters(req);
      const result = await TeamReportsService.getUserWiseReportPaginated(
        email,
        role,
        fromDate,
        toDate,
        page,
        pageSize,
        filters,
      );
      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getManagerWise(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const capabilities = await AccessService.getReportCapabilities(email, role);
      if (!capabilities.managerWise) {
        res.status(403).json({
          message: "Manager-wise reports are not available for your role.",
        });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const filters = getReportFilters(req);
      const rows = await TeamReportsService.getManagerWiseReport(
        email,
        role,
        fromDate,
        toDate,
        filters,
      );
      res.status(200).json({ rows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getDepartmentWise(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const capabilities = await AccessService.getReportCapabilities(email, role);
      if (!capabilities.departmentWise) {
        res.status(403).json({
          message: "Department-wise reports are available to department heads only.",
        });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const filters = getReportFilters(req);
      const rows = await TeamReportsService.getDepartmentWiseReport(
        email,
        role,
        fromDate,
        toDate,
        filters,
      );
      res.status(200).json({ rows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getOrganizationWise(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role !== UserRole.ADMIN && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Admin access only." });
        return;
      }

      const rows = await TeamReportsService.getOrganizationWiseReport(
        email,
        role,
      );
      res.status(200).json({ rows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getDashboardSummary(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Analytics access is restricted to Managers, HR, and Admins." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const filters = getReportFilters(req);

      const summary = await TeamReportsService.getDashboardSummary(
        email,
        role,
        fromDate,
        toDate,
        filters,
      );
      res.status(200).json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getSignedUpUsers(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Analytics access is restricted to Managers, HR, and Admins." });
        return;
      }

      const filters = getReportFilters(req);
      const users = await TeamReportsService.getSignedUpUsers(
        email,
        role,
        filters,
      );
      res.status(200).json(users);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async exportExcel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const tab =
        typeof req.query.tab === "string" ? req.query.tab : "user";

      const capabilities = await AccessService.getReportCapabilities(email, role);
      if (tab === "dept" && !capabilities.departmentWise) {
        res.status(403).json({
          message: "Department-wise reports are available to department heads only.",
        });
        return;
      }
      if (tab === "manager" && !capabilities.managerWise) {
        res.status(403).json({
          message: "Manager-wise reports are not available for your role.",
        });
        return;
      }
      if (tab === "org" && !capabilities.organizationWise) {
        res.status(403).json({
          message: "Organization-wise reports are available to admins only.",
        });
        return;
      }

      const { buffer, fileName } = await TeamReportsService.exportExcelReport(
        email,
        role,
        tab,
        fromDate,
        toDate,
        getReportFilters(req),
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.status(200).send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  }

  static async exportPdf(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const tab =
        typeof req.query.tab === "string" ? req.query.tab : "user";

      const capabilities = await AccessService.getReportCapabilities(email, role);
      if (tab === "dept" && !capabilities.departmentWise) {
        res.status(403).json({
          message: "Department-wise reports are available to department heads only.",
        });
        return;
      }
      if (tab === "manager" && !capabilities.managerWise) {
        res.status(403).json({
          message: "Manager-wise reports are not available for your role.",
        });
        return;
      }
      if (tab === "org" && !capabilities.organizationWise) {
        res.status(403).json({
          message: "Organization-wise reports are available to admins only.",
        });
        return;
      }

      const { buffer, fileName } = await TeamReportsService.exportPdfReport(
        email,
        role,
        tab,
        fromDate,
        toDate,
        getReportFilters(req),
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.status(200).send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  }

  static async getFilterOptions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role !== UserRole.ADMIN && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Admin access only." });
        return;
      }

      const options = await TeamReportsService.getReportFilterOptions(
        email,
        role,
      );
      res.status(200).json(options);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getScopedFilterOptions(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Analytics access is restricted to Managers, HR, and Admins." });
        return;
      }

      const options = await TeamReportsService.getScopedReportFilterOptions(
        email,
        role,
        getReportFilters(req),
      );
      res.status(200).json(options);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getEmployeeTimesheets(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE) {
        res.status(403).json({ message: "Managers, HR, and admins only." });
        return;
      }

      const empId =
        typeof req.query.empId === "string" ? req.query.empId.trim() : "";
      if (!empId) {
        res.status(400).json({ message: "Employee ID is required." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const detail = await TeamReportsService.getEmployeeTimesheetDetail(
        email,
        role,
        empId,
        fromDate,
        toDate,
      );
      res.status(200).json(detail);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  }

  static async getWorkforcePulse(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const role = getRole(req);
      if (role === UserRole.EMPLOYEE && !AccessService.isAdminEmail(email)) {
        res.status(403).json({ message: "Analytics access is restricted to Managers, HR, and Admins." });
        return;
      }

      const { fromDate, toDate } = getDateRange(req);
      const filters = getReportFilters(req);
      const pulse = await TeamReportsService.getWorkforcePulse(
        email,
        role,
        fromDate,
        toDate,
        filters,
      );
      res.status(200).json(pulse);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }
}

