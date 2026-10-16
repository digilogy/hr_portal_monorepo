import { Request, Response } from "express";
import type { SystemNotice, SystemNoticeType } from "@hr-portal/database";
import { logger } from "@hr-portal/logger";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { systemNoticeRepository } from "./systemNotice.repository";

const NOTICE_TYPES: SystemNoticeType[] = ["info", "warning", "error"];
const MAX_MESSAGE_LENGTH = 1000;

function toResponse(notice: SystemNotice | null) {
  return {
    message: notice?.message ?? "",
    type: notice?.type ?? "warning",
    isActive: notice?.isActive ?? false,
    updatedBy: notice?.updatedBy ?? null,
    updatedAt: notice?.updatedAt ?? null,
  };
}

export class SystemNoticeController {
  /** Public: what every user (logged in or on the login page) should see. */
  static async getActiveNotice(req: Request, res: Response): Promise<void> {
    try {
      const notice = await systemNoticeRepository.get();
      const active = notice?.isActive && notice.message.trim() ? notice : null;
      res.status(200).json({
        notice: active
          ? { message: active.message, type: active.type, updatedAt: active.updatedAt }
          : null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SystemNoticeController", "Failed to fetch active notice", { error: message });
      res.status(500).json({ message });
    }
  }

  /** Superadmin: current saved notice, including when it is switched off. */
  static async getNotice(req: Request, res: Response): Promise<void> {
    try {
      const notice = await systemNoticeRepository.get();
      res.status(200).json(toResponse(notice));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SystemNoticeController", "Failed to fetch notice", { error: message });
      res.status(500).json({ message });
    }
  }

  static async updateNotice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { message, type, isActive } = req.body ?? {};

      if (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({ message: `Message must be text up to ${MAX_MESSAGE_LENGTH} characters` });
        return;
      }
      if (!NOTICE_TYPES.includes(type)) {
        res.status(400).json({ message: "Type must be one of info, warning, error" });
        return;
      }
      if (isActive && !message.trim()) {
        res.status(400).json({ message: "Enter a message before enabling the notice" });
        return;
      }

      const saved = await systemNoticeRepository.upsert({
        message: message.trim(),
        type,
        isActive: Boolean(isActive),
        updatedBy: req.user?.email ?? null,
      });

      logger.info("SystemNoticeController", "Maintenance notice updated", {
        isActive: saved.isActive,
        type: saved.type,
        updatedBy: saved.updatedBy,
      });
      res.status(200).json(toResponse(saved));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SystemNoticeController", "Failed to update notice", { error: message });
      res.status(500).json({ message });
    }
  }
}
