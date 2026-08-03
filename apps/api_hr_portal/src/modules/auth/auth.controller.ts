import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import {
  requestAccessSchema,
  verifyTokenQuerySchema,
  setupPinSchema,
  loginSchema,
  forgotPinSchema,
} from "./auth.schemas";

export class AuthController {
  static async requestAccess(req: Request, res: Response): Promise<void> {
    try {
      const parsed = requestAccessSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      const response = await AuthService.requestAccess(parsed.data.email);
      res.status(200).json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async verifySetupToken(req: Request, res: Response): Promise<void> {
    try {
      const parsed = verifyTokenQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ message: "Token is required" });
        return;
      }

      const response = await AuthService.verifySetupToken(parsed.data.token);
      res.status(200).json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async setupPin(req: Request, res: Response): Promise<void> {
    try {
      const parsed = setupPinSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Token and PIN are required" });
        return;
      }

      const response = await AuthService.setupPin(parsed.data.token, parsed.data.pin);
      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Email and PIN are required" });
        return;
      }

      const response = await AuthService.login(parsed.data.email, parsed.data.pin);
      res.status(200).json(response);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }

  static async forgotPin(req: Request, res: Response): Promise<void> {
    try {
      const parsed = forgotPinSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      const response = await AuthService.forgotPin(parsed.data.email);
      res.status(200).json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}
