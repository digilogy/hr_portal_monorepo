import { Router } from "express";
import { ProfileController } from "./profile.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);
router.get("/me", ProfileController.getMyProfile);
router.put("/me/preferred-timing", ProfileController.updatePreferredTiming);

export default router;
