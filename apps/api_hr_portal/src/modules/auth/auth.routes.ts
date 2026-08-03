import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();

router.post("/request-access", AuthController.requestAccess);
router.get("/verify-token", AuthController.verifySetupToken);
router.post("/setup-pin", AuthController.setupPin);
router.post("/login", AuthController.login);

router.post("/forgot-pin", AuthController.forgotPin);

export default router;
