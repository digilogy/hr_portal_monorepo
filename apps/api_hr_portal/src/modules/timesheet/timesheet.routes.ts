import { Router } from "express";
import { TimesheetController } from "./timesheet.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.post("/save", TimesheetController.saveDay);
router.get("/history", TimesheetController.getHistory);
router.get("/day/:date", TimesheetController.getDay);

export default router;
