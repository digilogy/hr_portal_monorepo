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

  /** SSO hub: POST /auth/internal/sso/lookup */
  static async ssoLookup(req: Request, res: Response): Promise<void> {
    try {
      const email = String(req.body?.email ?? "").toLowerCase().trim();
      if (!email) {
        res.status(400).json({ error: "email required" });
        return;
      }
      const result = await AuthService.ssoLookup(email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Lookup failed" });
    }
  }

  /** SSO hub: POST /auth/internal/sso/provision */
  static async ssoProvision(req: Request, res: Response): Promise<void> {
    try {
      const email = String(req.body?.email ?? "").toLowerCase().trim();
      if (!email) {
        res.status(400).json({ error: "email required" });
        return;
      }
      const result = await AuthService.ssoProvision({
        email,
        name: String(req.body?.name ?? email.split("@")[0]),
        pin: req.body?.pin ? String(req.body.pin) : undefined,
        authUserId: req.body?.authUserId ? String(req.body.authUserId) : undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Provision failed" });
    }
  }

  /** SSO hub: GET /auth/internal/sso/directory */
  static async ssoDirectory(req: Request, res: Response): Promise<void> {
    try {
      const kind = req.query.kind === "registered" ? "registered" : "employees";
      const result = await AuthService.ssoDirectory({
        kind,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        department:
          typeof req.query.department === "string" ? req.query.department : undefined,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Directory failed" });
    }
  }

  /** SSO hub: GET /auth/internal/sso/departments */
  static async ssoDepartments(_req: Request, res: Response): Promise<void> {
    try {
      const data = await AuthService.ssoDepartments();
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Departments failed" });
    }
  }

  /** SSO hub admin: POST /auth/internal/sso/change-email */
  static async ssoChangeEmail(req: Request, res: Response): Promise<void> {
    try {
      const oldEmail = String(req.body?.oldEmail ?? "").toLowerCase().trim();
      const newEmail = String(req.body?.newEmail ?? "").toLowerCase().trim();
      if (!oldEmail || !newEmail) {
        res.status(400).json({ success: false, error: "oldEmail and newEmail required" });
        return;
      }
      const result = await AuthService.ssoChangeEmail(oldEmail, newEmail);
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || "Change email failed",
      });
    }
  }

  /** SSO hub admin: POST /auth/internal/sso/update-profile */
  static async ssoUpdateProfile(req: Request, res: Response): Promise<void> {
    try {
      const email = String(req.body?.email ?? "").toLowerCase().trim();
      if (!email) {
        res.status(400).json({ success: false, error: "email required" });
        return;
      }
      const result = await AuthService.ssoUpdateProfile({
        email,
        newEmail: req.body?.newEmail,
        employeeId: req.body?.employeeId,
        employeeName: req.body?.employeeName,
        department: req.body?.department,
        mobileNumber: req.body?.mobileNumber,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || "Update profile failed",
      });
    }
  }

  /** Browser SSO: exchange hub code for HR session */
  static async ssoExchange(req: Request, res: Response): Promise<void> {
    try {
      const code = String(req.body?.code ?? "");
      if (!code) {
        res.status(400).json({
          success: false,
          error: { code: "SSO_EXCHANGE_FAILED", message: "code required" },
        });
        return;
      }
      const frontend = (process.env.FRONTEND_URL || "http://localhost:3661").replace(
        /\/$/,
        "",
      );
      const result = await AuthService.exchangeSsoCode({
        code,
        redirectUri:
          typeof req.body?.redirectUri === "string"
            ? req.body.redirectUri
            : `${frontend}/sso/callback/`,
      });

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.token,
          user: result.user,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: {
          code: "SSO_EXCHANGE_FAILED",
          message: error.message || "SSO sign-in failed",
        },
      });
    }
  }
}
