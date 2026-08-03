import { AppDataSource, User, TimesheetSlot } from "@hr-portal/database";
import { TimesheetService } from "../src/modules/timesheet/timesheet.service";

const CHRISILDA_EMAIL = "chrisildanabisha@casagrand.co.in";

const dayPlans: Array<{
  titlePrefix: string;
  slots: TimesheetSlot[];
}> = [
  {
    titlePrefix: "Sprint Planning",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 10:30 AM",
        title: "Sprint Planning",
        task: "Reviewed backlog items and estimated tasks for the Give And Take project sprint.",
        taskType: "Meeting",
      },
      {
        key: "2",
        timeSlot: "10:30 AM - 12:30 PM",
        title: "HR Portal UI Updates",
        task: "Implemented report drawer changes and validated timesheet save flow in staging.",
        taskType: "Custom",
      },
      {
        key: "3",
        timeSlot: "1:30 PM - 3:00 PM",
        title: "Stakeholder Sync",
        task: "Discussed utilization report requirements with the project manager and HR team.",
        taskType: "Meeting",
      },
      {
        key: "4",
        timeSlot: "3:00 PM - 5:00 PM",
        title: "Bug Fixes",
        task: "Resolved date-range filtering issues affecting logged hours in user-wise reports.",
        taskType: "Custom",
      },
    ],
  },
  {
    titlePrefix: "API Integration",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 11:00 AM",
        title: "API Integration",
        task: "Connected employee roster API with manager hierarchy and access checks.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "11:00 AM - 12:00 PM",
        title: "Team Standup",
        task: "Shared progress on reports module and blockers for timesheet linking.",
        taskType: "Meeting",
      },
      {
        key: "3",
        timeSlot: "1:00 PM - 3:30 PM",
        title: "Database Review",
        task: "Verified employee master data mappings for department and manager fields.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "3:30 PM - 5:00 PM",
        title: "Code Review",
        task: "Reviewed pull requests for export excel and pagination fixes.",
        taskType: "Meeting",
      },
    ],
  },
  {
    titlePrefix: "Documentation",
    slots: [
      {
        key: "1",
        timeSlot: "9:30 AM - 11:30 AM",
        title: "Documentation",
        task: "Documented report calculation logic for user-wise and manager-wise views.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "11:30 AM - 12:30 PM",
        title: "Client Call",
        task: "Walkthrough of My Team page and timesheet submission status for managers.",
        taskType: "Meeting",
      },
      {
        key: "3",
        timeSlot: "2:00 PM - 4:00 PM",
        title: "Test Cases",
        task: "Added manual test scenarios for manager login and downline visibility.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "4:00 PM - 5:30 PM",
        title: "Deployment Prep",
        task: "Prepared release notes and smoke test checklist for HR portal updates.",
        taskType: "Custom",
      },
    ],
  },
  {
    titlePrefix: "Feature Development",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 10:00 AM",
        title: "Daily Standup",
        task: "Aligned on task detail drawer work for reports and team pages.",
        taskType: "Meeting",
      },
      {
        key: "2",
        timeSlot: "10:00 AM - 12:00 PM",
        title: "Feature Development",
        task: "Built employee timesheet detail endpoint for managers and admins.",
        taskType: "Custom",
      },
      {
        key: "3",
        timeSlot: "1:00 PM - 2:30 PM",
        title: "UI Polish",
        task: "Updated avatar initials and clickable employee names in report tables.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "2:30 PM - 5:00 PM",
        title: "Regression Testing",
        task: "Tested Excel export and department grouping after normalization fix.",
        taskType: "Custom",
      },
    ],
  },
  {
    titlePrefix: "Data Validation",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 11:30 AM",
        title: "Data Validation",
        task: "Validated bulk-uploaded employee records against official email IDs.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "11:30 AM - 12:30 PM",
        title: "Lunch Break",
        task: "Break time away from desk.",
        taskType: "Lunch",
      },
      {
        key: "3",
        timeSlot: "1:30 PM - 3:30 PM",
        title: "Manager Reports",
        task: "Fixed manager-wise aggregation to exclude upline managers from team views.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "3:30 PM - 5:00 PM",
        title: "Support",
        task: "Helped team members troubleshoot timesheet save and login email mismatch.",
        taskType: "Meeting",
      },
    ],
  },
  {
    titlePrefix: "Weekend Support",
    slots: [
      {
        key: "1",
        timeSlot: "10:00 AM - 12:00 PM",
        title: "Weekend Support",
        task: "Monitored release environment and verified no report API failures.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "12:00 PM - 1:00 PM",
        title: "Break",
        task: "Short break between support checks.",
        taskType: "Break",
      },
    ],
  },
  {
    titlePrefix: "Release Monitoring",
    slots: [
      {
        key: "1",
        timeSlot: "11:00 AM - 1:00 PM",
        title: "Release Monitoring",
        task: "Checked dashboard KPIs and department chart after admin login.",
        taskType: "Custom",
      },
    ],
  },
  {
    titlePrefix: "Sprint Execution",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 10:30 AM",
        title: "Sprint Execution",
        task: "Completed assigned stories for reports pagination and export excel.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "10:30 AM - 12:30 PM",
        title: "Team Collaboration",
        task: "Pair programming session on access service and downline hierarchy logic.",
        taskType: "Meeting",
      },
      {
        key: "3",
        timeSlot: "1:30 PM - 4:00 PM",
        title: "Timesheet Module",
        task: "Ensured task title and description are persisted correctly for each slot.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "4:00 PM - 5:00 PM",
        title: "Status Update",
        task: "Submitted end-of-day update to reporting manager on project progress.",
        taskType: "Meeting",
      },
    ],
  },
  {
    titlePrefix: "Quality Assurance",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 11:00 AM",
        title: "Quality Assurance",
        task: "Verified user-wise utilization calculations for selected date ranges.",
        taskType: "Custom",
      },
      {
        key: "2",
        timeSlot: "11:00 AM - 12:00 PM",
        title: "Design Review",
        task: "Reviewed My Team detail drawer layout and field mapping with UX.",
        taskType: "Meeting",
      },
      {
        key: "3",
        timeSlot: "1:00 PM - 3:00 PM",
        title: "Backend Fixes",
        task: "Patched timezone handling in report date filters for IST users.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "3:00 PM - 5:30 PM",
        title: "Knowledge Transfer",
        task: "Shared report architecture notes with new team member joining the project.",
        taskType: "Meeting",
      },
    ],
  },
  {
    titlePrefix: "Weekly Wrap-up",
    slots: [
      {
        key: "1",
        timeSlot: "9:00 AM - 10:30 AM",
        title: "Weekly Wrap-up",
        task: "Summarized completed tasks and pending items for the HR portal sprint.",
        taskType: "Meeting",
      },
      {
        key: "2",
        timeSlot: "10:30 AM - 12:30 PM",
        title: "Report Enhancements",
        task: "Added clickable employee names with task history in the reports tab.",
        taskType: "Custom",
      },
      {
        key: "3",
        timeSlot: "1:30 PM - 3:00 PM",
        title: "Demo Preparation",
        task: "Prepared demo data and walkthrough for manager login scenarios.",
        taskType: "Custom",
      },
      {
        key: "4",
        timeSlot: "3:00 PM - 5:00 PM",
        title: "Timesheet Entry",
        task: "Logged remaining tasks and validated totals for the current week.",
        taskType: "Custom",
      },
    ],
  },
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  await AppDataSource.initialize();

  const user = await AppDataSource.getRepository(User)
    .createQueryBuilder("user")
    .where("LOWER(user.email) = LOWER(:email)", { email: CHRISILDA_EMAIL })
    .getOne();

  if (!user) {
    throw new Error(`User not found for ${CHRISILDA_EMAIL}`);
  }

  const today = new Date();
  const dates: string[] = [];
  for (let offset = 9; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(formatDate(date));
  }

  console.log(`Seeding timesheets for ${CHRISILDA_EMAIL} (userId=${user.id})`);
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const plan = dayPlans[index % dayPlans.length];
    const saved = await TimesheetService.saveDay(user.id, date, plan.slots);
    console.log(
      `${date}: ${saved.totalHours}h (${plan.titlePrefix}) - ${plan.slots.length} tasks`,
    );
  }

  await AppDataSource.destroy();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
