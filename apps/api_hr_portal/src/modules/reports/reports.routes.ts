import { Router } from "express";
import { ReportsController } from "./teamReports.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);
router.get("/filter-options", ReportsController.getFilterOptions);
router.get("/filter-options/scoped", ReportsController.getScopedFilterOptions);
router.get("/capabilities", ReportsController.getCapabilities);
router.get("/user-wise", ReportsController.getUserWise);
router.get("/manager-wise", ReportsController.getManagerWise);
router.get("/department-wise", ReportsController.getDepartmentWise);
router.get("/organization-wise", ReportsController.getOrganizationWise);
router.get("/dashboard-summary", ReportsController.getDashboardSummary);
router.get("/signed-up-users", ReportsController.getSignedUpUsers);
router.get("/workforce-pulse", ReportsController.getWorkforcePulse);
router.get("/export/excel", ReportsController.exportExcel);
router.get("/export/pdf", ReportsController.exportPdf);
router.get("/employee-timesheets", ReportsController.getEmployeeTimesheets);

export default router;
