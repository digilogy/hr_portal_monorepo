import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource, initializeDatabase } from "@hr-portal/database";
import { TimesheetRealignService } from "../src/services/timesheetRealign.service";

dotenv.config();

/**
 * Moves saved timesheet entries onto each user's current shift slots. Only editable days
 * (today and the previous two working days) are changed; older days keep their logged times.
 *
 *   npm run realign-timesheets --workspace=@hr-portal/api-hr-portal -- --dry-run
 *   npm run realign-timesheets --workspace=@hr-portal/api-hr-portal
 *   npm run realign-timesheets --workspace=@hr-portal/api-hr-portal -- --employee=CG1234
 *   npm run realign-timesheets --workspace=@hr-portal/api-hr-portal -- --restore
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const restore = args.includes("--restore");
  const employeeIds = args
    .filter((arg) => arg.startsWith("--employee="))
    .map((arg) => arg.slice("--employee=".length).trim())
    .filter(Boolean);

  await initializeDatabase(); // also adds the originalSlots column if missing

  if (restore) {
    const restored = await TimesheetRealignService.restore();
    console.log(`Restored ${restored} day(s) to their original slots.`);
  } else {
    const summary = await TimesheetRealignService.realign({
      dryRun,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
    });
    console.log(
      `${dryRun ? "[dry run] Would change" : "Changed"} ${summary.changed} of ${summary.scanned} day(s) ` +
        `across ${summary.usersAffected} user(s).`,
    );
  }

  await AppDataSource.destroy();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
