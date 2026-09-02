import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ProfileService } from "./profile.service";

export class ProfileController {
  static async getMyProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const profile = await ProfileService.getProfileByEmail(email);
      if (!profile) {
        res.status(404).json({
          message: "Employee profile not found for this account.",
        });
        return;
      }

      res.status(200).json({ profile });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }

  static async updatePreferredTiming(req: AuthRequest, res: Response): Promise<void> {
    try {
      const email = req.user?.email;
      const { preferredTiming } = req.body;
      if (!email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      await ProfileService.updatePreferredTiming(email, preferredTiming);
      res.status(200).json({ message: "Updated successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message });
    }
  }
}
