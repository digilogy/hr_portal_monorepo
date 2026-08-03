import { Router } from "express";
import { TeamController } from "./teamReports.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);
router.get("/roster", TeamController.getRoster);

export default router;
