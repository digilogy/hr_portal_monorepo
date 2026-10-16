import { Router } from "express";
import { SystemNoticeController } from "./systemNotice.controller";
import { authenticateJWT, authorizeSuperAdmin } from "../../middlewares/auth.middleware";

const router = Router();

// Public so the banner also shows on the login page.
router.get("/notice", SystemNoticeController.getActiveNotice);

router.get("/notice/manage", authenticateJWT, authorizeSuperAdmin, SystemNoticeController.getNotice);
router.put("/notice", authenticateJWT, authorizeSuperAdmin, SystemNoticeController.updateNotice);

export default router;
