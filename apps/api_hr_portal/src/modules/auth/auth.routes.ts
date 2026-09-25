import { Router, Request, Response, NextFunction } from "express";
import { AuthController } from "./auth.controller";

const router = Router();

const PROVISION_SECRET =
  process.env.SSO_PROVISION_SECRET ||
  process.env.PROVISION_SECRET ||
  "real-sso-provision-demo";

function requireProvisionSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers["x-provision-secret"];
  if (secret !== PROVISION_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/request-access", AuthController.requestAccess);
router.get("/verify-token", AuthController.verifySetupToken);
router.post("/setup-pin", AuthController.setupPin);
router.post("/login", AuthController.login);
router.post("/forgot-pin", AuthController.forgotPin);

// SSO hub internal (shared secret)
router.post("/internal/sso/lookup", requireProvisionSecret, AuthController.ssoLookup);
router.post("/internal/sso/provision", requireProvisionSecret, AuthController.ssoProvision);
router.get("/internal/sso/directory", requireProvisionSecret, AuthController.ssoDirectory);
router.get("/internal/sso/departments", requireProvisionSecret, AuthController.ssoDepartments);
router.post("/internal/sso/change-email", requireProvisionSecret, AuthController.ssoChangeEmail);
router.post("/internal/sso/update-profile", requireProvisionSecret, AuthController.ssoUpdateProfile);

// Browser SSO: exchange hub code for HR session
router.post("/sso/exchange", AuthController.ssoExchange);

export default router;
