import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticateJWT, authorizeRole } from "../../middlewares/auth.middleware";
import { uploadFile } from "../../middlewares/upload.middleware";
import { UserRole } from "@hr-portal/database";

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRole([UserRole.ADMIN])); // Only admin users can upload employee data

router.post(
  "/bulk-upload",
  uploadFile.single("file"),
  AdminController.bulkUploadUsers,
);
router.post(
  "/bulk-upload-shifts",
  uploadFile.single("file"),
  AdminController.bulkUploadShifts,
);
router.post(
  "/bulk-upload-master",
  uploadFile.single("file"),
  AdminController.bulkUploadMaster,
);
router.get("/bulk-upload/status/:jobId", AdminController.getUploadStatus);
router.get("/email-logs", AdminController.listEmailLogs);
router.get("/email-logs/:emailLogId", AdminController.getEmailLog);
router.post("/email-logs/:emailLogId/retry", AdminController.retryEmailLog);

export default router;
