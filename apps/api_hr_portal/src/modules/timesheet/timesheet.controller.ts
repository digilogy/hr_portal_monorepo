import { Response } from "express";
import { TimesheetService } from "./timesheet.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { TimesheetSlot } from "@hr-portal/database";
import { saveDaySchema } from "./timesheet.schemas";

export class TimesheetController {
  static async saveDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const parsed = saveDaySchema.safeParse(req.body);

      if (userId === undefined || !parsed.success) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      const { date, slots } = parsed.data;

      const entry = await TimesheetService.saveDay(userId, date, slots as TimesheetSlot[]);
      res.status(200).json(entry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  }

  static async getDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { date } = req.params;

      if (userId === undefined || !date) {
        res.status(400).json({ message: "Invalid request" });
        return;
      }

      const entry = await TimesheetService.getDay(userId, date);
      res.status(200).json(entry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (userId === undefined) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const excludeDate =
        typeof req.query.excludeDate === "string"
          ? req.query.excludeDate
          : undefined;
      const fromDate =
        typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
      const toDate =
        typeof req.query.toDate === "string" ? req.query.toDate : undefined;
      const limit =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : 30;

      const entries = await TimesheetService.getHistory(userId, {
        excludeDate,
        fromDate,
        toDate,
        limit: Number.isNaN(limit) ? 30 : limit,
      });
      res.status(200).json(entries);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async getMySummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId || !email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const fromDateStr = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
      const toDateStr = typeof req.query.toDate === "string" ? req.query.toDate : undefined;

      if (!fromDateStr || !toDateStr) {
        res.status(400).json({ message: "fromDate and toDate are required" });
        return;
      }

      // We need to import dayjs, ProfileService, and calculateDashboardStats
      // But we will use require to avoid messing up imports at the top if we don't have to
      const dayjs = require("dayjs");
      const { ProfileService } = require("../profile/profile.service");
      const { calculateDashboardStats } = require("./dashboard.utils");

      const periodFrom = dayjs(fromDateStr);
      const periodTo = dayjs(toDateStr);
      const today = dayjs();

      const profile = await ProfileService.getProfileByEmail(email);
      const entries = await TimesheetService.getHistory(userId, {
        fromDate: fromDateStr,
        toDate: toDateStr,
        limit: 100, // Should be enough for a single month/period
      });

      const stats = calculateDashboardStats(profile, entries, periodFrom, periodTo, today);

      res.status(200).json({ stats, entries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }
}
