import { Request, Response } from "express";
import { logger } from "@hr-portal/logger";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { LiveLogService } from "../../services/liveLog.service";

const MAX_LIMIT = 1000;

// Superadmin "Logs" page: the same store the /logxz viewer reads, behind portal login.
export class SystemLogsController {
  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, MAX_LIMIT);
      const level = typeof req.query.level === "string" ? req.query.level : undefined;
      const service = typeof req.query.service === "string" ? req.query.service : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;

      const logs = await LiveLogService.getInstance().getRecentLogs(limit, level, search, service);
      res.status(200).json({ logs });
    } catch (error: any) {
      logger.error("SystemLogs", "Failed to read logs", { error: error?.message });
      res.status(500).json({ message: "Failed to load logs" });
    }
  }

  static async clearLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      await LiveLogService.getInstance().clearLogs();
      logger.warn("SystemLogs", "Logs cleared", { by: req.user?.email });
      res.status(200).json({ message: "Logs cleared" });
    } catch (error: any) {
      logger.error("SystemLogs", "Failed to clear logs", { error: error?.message });
      res.status(500).json({ message: "Failed to clear logs" });
    }
  }
}
